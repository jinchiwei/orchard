#!/bin/bash
# ResearchLog: Fetch recent results from experiment markdown files
# Reads the first non-heading, non-empty line from the most recent .md as the blurb
# Output: JSON

REPO="$HOME/arcadia/research-log"
cd "$REPO" 2>/dev/null || { echo '{"projects":[]}'; exit 0; }

git fetch --quiet 2>/dev/null
git pull --rebase --quiet 2>/dev/null

python3 -c "
import json, os, re, subprocess, glob

repo = '$REPO'
projects = []

def get_blurb(filepath):
    \"\"\"Get the one-liner blurb from a result file.
    First line that isn't a heading, empty, or metadata.\"\"\"
    skip_prefixes = ('date:', 'setup:', 'model:', 'task:', 'data:', 'duration:',
                     'project:', 'status:', '**date', '**setup', '**model',
                     '**task', '**data', '**duration', '**project', '**status',
                     '|')
    try:
        with open(filepath) as f:
            for line in f:
                stripped = line.strip()
                if not stripped or stripped.startswith('#'):
                    continue
                if stripped.lower().startswith(skip_prefixes):
                    continue
                # Clean markdown formatting
                stripped = re.sub(r'\*\*([^*]+)\*\*', r'\1', stripped)
                stripped = re.sub(r'\*([^*]+)\*', r'\1', stripped)
                stripped = stripped.lstrip('- ')
                if len(stripped) > 10:
                    return stripped
    except:
        pass
    return ''

def get_time(filepath):
    try:
        r = subprocess.run(
            ['git', 'log', '-1', '--format=%ar', '--', filepath],
            capture_output=True, text=True, timeout=5, cwd=repo
        )
        return r.stdout.strip() or 'unknown'
    except:
        return 'unknown'

project_order = ['brainlab', 'wolong', 'curiedx', 'papers', 'musegen', 'musidia']
all_dirs = [d for d in os.listdir(repo) if os.path.isdir(os.path.join(repo, d)) and not d.startswith('.')]
all_dirs.sort(key=lambda d: project_order.index(d) if d in project_order else len(project_order))

for project in all_dirs:
    ppath = os.path.join(repo, project)
    if not os.path.isdir(ppath) or project.startswith('.'):
        continue

    experiments = []
    for exp in sorted(os.listdir(ppath)):
        epath = os.path.join(ppath, exp)
        if not os.path.isdir(epath) or exp.startswith('.'):
            continue

        # Find all .md files in this experiment (including subdirs)
        md_files = sorted(glob.glob(os.path.join(epath, '**', '*.md'), recursive=True), reverse=True)
        if not md_files:
            continue

        latest = md_files[0]
        blurb = get_blurb(latest)
        time = get_time(latest)

        if blurb:
            # Parse structured blurb: metric | result | next
            parts = [p.strip() for p in blurb.split('|')]
            if len(parts) >= 3:
                entry = {
                    'name': exp,
                    'time': time,
                    'metric': parts[0],
                    'result': parts[1],
                    'next': parts[2],
                }
            else:
                entry = {
                    'name': exp,
                    'time': time,
                    'metric': '',
                    'result': blurb,
                    'next': '',
                }
            experiments.append(entry)

    if experiments:
        projects.append({'name': project, 'experiments': experiments})

print(json.dumps({'projects': projects}))
"
