function skipUser( username ) {
	const skippedUsers = [
		'github-actions'
	];

	if ( -1 !== skippedUsers.indexOf( username ) ) {
		return true;
	}

	return false;
}

function contributorAlreadyPresent( login ) {
	const contributorTypes = ['committers', 'reviewers', 'commenters', 'reporters'];

	for (const contributorType of contributorTypes) {
		if ( coAuthorData[contributorType].has( login ) ) {
			return true;
		}
	}
}

const escapeForGql = string => '_' + string.replace(/[./-]/g, '_');

const coAuthorData = {
	userData: [],
	committers: new Set(),
	reviewers: new Set(),
	commenters: new Set(),
	reporters: new Set(),
	linkedIssueCommenters: new Set()
};

const contributorData = await github.graphql(
	`query($owner:String!, $name:String!, $prNumber:Int!) {
		repository(owner:$owner, name:$name) {
			pullRequest(number:$prNumber) {
				commits(first: 100) {
					nodes {
						commit {
							author {
								user {
									databaseId
									login
									name
									email
								}
								name
								email
							}
						}
					}
				}
				reviews(first: 100) {
					nodes {
						author {
							login
						}
					}
				}
				comments(first: 100) {
					nodes {
						author {
							login
						}
					}
				}
				closingIssuesReferences(first:100){
					nodes {
						author {
							login
						}
						comments(first:100) {
							nodes {
								author {
									login
								}
							}
						}
					}
				}
			}
		}
	}`,
	{
		owner: 'WordPress',
		name: 'gutenberg',
		prNumber: 38164
	}
);

for (const commit of contributorData.repository.pullRequest.commits.nodes) {
	if ( null == commit.commit.author.user ) {
		coAuthorData.committers.add(commit.commit.author.email);
		coAuthorData.userData[commit.commit.author.email] = {
			name: commit.commit.author.name,
			email: commit.commit.author.email
		};
	} else {
		if ( skipUser( commit.commit.author.user.login ) ) {
			continue;
		}

		coAuthorData.committers.add(commit.commit.author.user.login);
		coAuthorData.userData[commit.commit.author.user.login] = commit.commit.author.user;
	}
}

for (const review of contributorData.repository.pullRequest.reviews.nodes) {
	if ( skipUser( review.author.login ) ) {
		continue;
	}

	// Only store reviewers that aren't committers.
	if (!contributorAlreadyPresent( review.author.login ) ) {
		coAuthorData.reviewers.add(review.author.login);
	}
}

for (const comment of contributorData.repository.pullRequest.comments.nodes) {
	if ( skipUser( comment.author.login ) ) {
		continue;
	}

	// Only store commenters that aren't committers or reviewers.
	if (!contributorAlreadyPresent( comment.author.login ) ) {
		coAuthorData.commenters.add(comment.author.login);
	}
}


// Grab reporters and commenters on linked issues.
for (const linkedIssue of contributorData.repository.pullRequest.closingIssuesReferences.nodes){
	if (!contributorAlreadyPresent( linkedIssue.author.login ) && !skipUser( linkedIssue.author.login ) ) {
		coAuthorData.reporters.add(linkedIssue.author.login);
	}

	for (const issueComment of linkedIssue.comments.nodes){
		if ( skipUser( issueComment.author.login ) ) {
			continue;
		}

		if (!contributorAlreadyPresent( issueComment.author.login ) ) {
			coAuthorData.linkedIssueCommenters.add( issueComment.author.login );
		}
	}
}

console.debug( coAuthorData );

// We already have user info for committers, we need to grab it for everyone else.
const userData = await github.graphql(
	'{' +
		[...coAuthorData.reviewers, ...coAuthorData.commenters, ...coAuthorData.reporters, ...coAuthorData.linkedIssueCommenters].map(user =>
			escapeForGql(user) + `: user(login: "${user}") {databaseId, login, name, email}`
		) +
	'}'
);

Object.values(userData).forEach(user => {
	coAuthorData.userData[user.login] = user;
});

console.debug( coAuthorData );

const priorities = ['committers', 'reviewers', 'commenters', 'reporters'];

const coAuthors = priorities.map(priority => {
	// Skip an empty set of contributors.
	if (coAuthorData[priority].length === 0) {
		return [];
	}

	// Add a header for each section.
	const header = '# ' + priority.replace(/^./, char => char.toUpperCase()) + '\n';

	// Generate each Co-authored-by entry, and join them into a single string.
	return header + [...coAuthorData[priority]].map(username => {
		const {name, databaseId, email} = coAuthorData.userData[username];
		const commitEmail = email || `${databaseId}+${username}@users.noreply.github.com`;

		return `Co-authored-by: ${name} <${commitEmail}>`;
	}).join('\n');
}).join('\n');

console.log( coAuthors );
