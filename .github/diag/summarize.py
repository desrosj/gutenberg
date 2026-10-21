import json, sys

path, variant = sys.argv[1], sys.argv[2]
rows = []
try:
    with open(path) as f:
        rows = [json.loads(line) for line in f if line.strip()]
except FileNotFoundError:
    pass
failed = [r for r in rows if not r['passed']]
print(f'{variant}: {len(failed)} of {len(rows)} runs of the test failed')


def show(r):
    print(f"===== run {r['run']} passed={r['passed']}")
    print(r['content'])
    for e in r['trace'] or []:
        print(json.dumps(e, ensure_ascii=True))


for r in failed:
    show(r)
for r in [r for r in rows if r['passed']][:2]:
    show(r)
