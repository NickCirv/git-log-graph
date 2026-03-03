#!/usr/bin/env node
// git-log-graph — Beautiful, colorful ASCII git log graph
// Zero external dependencies. Node 18+ ES modules.

import { execFileSync, spawnSync } from 'child_process';
import * as readline from 'readline';
import * as process from 'process';

// ─── ANSI Colors ────────────────────────────────────────────────────────────

const RESET   = '\x1b[0m';
const BOLD    = '\x1b[1m';
const DIM     = '\x1b[2m';

const LANE_COLORS = [
  '\x1b[36m',   // cyan
  '\x1b[33m',   // yellow
  '\x1b[35m',   // magenta
  '\x1b[32m',   // green
  '\x1b[34m',   // blue
  '\x1b[31m',   // red
];

const AUTHOR_COLORS = [
  '\x1b[96m',   // bright cyan
  '\x1b[93m',   // bright yellow
  '\x1b[95m',   // bright magenta
  '\x1b[92m',   // bright green
  '\x1b[94m',   // bright blue
  '\x1b[91m',   // bright red
];

function laneColor(idx) {
  return LANE_COLORS[idx % LANE_COLORS.length];
}

function authorColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AUTHOR_COLORS[h % AUTHOR_COLORS.length];
}

// ─── Argument Parsing ────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    count: 100,
    all: false,
    author: null,
    since: null,
    search: null,
    stat: false,
    compact: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--all')          { opts.all = true; }
    else if (a === '--stat')    { opts.stat = true; }
    else if (a === '--compact') { opts.compact = true; }
    else if (a === '--help' || a === '-h') { opts.help = true; }
    else if (a === '--count'  && args[i+1]) { opts.count  = parseInt(args[++i], 10); }
    else if (a === '--author' && args[i+1]) { opts.author = args[++i]; }
    else if (a === '--since'  && args[i+1]) { opts.since  = args[++i]; }
    else if (a === '--search' && args[i+1]) { opts.search = args[++i]; }
  }

  return opts;
}

function printHelp() {
  console.log(`
${BOLD}git-log-graph${RESET} (alias: ${BOLD}glg${RESET})
Beautiful, colorful ASCII git log graph.

${BOLD}Usage:${RESET}
  git-log-graph [options]
  glg [options]

${BOLD}Options:${RESET}
  --count  <n>       Limit commits shown          (default: 100)
  --all              Show all branches             (default: current branch)
  --author <name>    Filter by author name
  --since  <date>    Filter by date, e.g. "2 weeks ago"
  --search <text>    Filter commits by message
  --stat             Show files changed per commit
  --compact          One-line-per-commit mode
  --help, -h         Show this help

${BOLD}Examples:${RESET}
  git-log-graph --count 50
  git-log-graph --all --author "Jane"
  git-log-graph --since "1 week ago" --search "feat"
  git-log-graph --stat
  git-log-graph --compact
`);
}

// ─── Git Integration ─────────────────────────────────────────────────────────

function gitExecFile(args) {
  try {
    const result = execFileSync('git', args, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });
    return result;
  } catch (e) {
    return null;
  }
}

function isGitRepo() {
  const r = gitExecFile(['rev-parse', '--is-inside-work-tree']);
  return r && r.trim() === 'true';
}

function fetchLog(opts) {
  const gitArgs = ['log'];

  if (opts.all) gitArgs.push('--all');
  gitArgs.push('--format=%H\t%P\t%aI\t%an\t%s');
  gitArgs.push(`-n`, String(opts.count));

  if (opts.author) gitArgs.push(`--author=${opts.author}`);
  if (opts.since)  gitArgs.push(`--since=${opts.since}`);
  if (opts.search) gitArgs.push(`--grep=${opts.search}`);

  const raw = gitExecFile(gitArgs);
  if (!raw) return [];

  return raw.trim().split('\n').filter(Boolean).map(line => {
    const parts = line.split('\t');
    const hash    = parts[0] || '';
    const parents = (parts[1] || '').split(' ').filter(Boolean);
    const date    = parts[2] || '';
    const author  = parts[3] || '';
    const subject = parts[4] || '';
    return { hash, parents, date, author, subject };
  });
}

function fetchStat(hash) {
  const raw = gitExecFile(['show', '--stat', '--format=', hash]);
  if (!raw) return [];

  const lines = raw.trim().split('\n').filter(Boolean);
  // Last line is summary like "3 files changed..."
  const result = [];
  for (const ln of lines) {
    if (!ln.match(/^\s*\d+ files? changed/)) {
      result.push(ln.trim());
    } else {
      result.push(DIM + ln.trim() + RESET);
    }
  }
  return result;
}

// ─── Relative Dates ──────────────────────────────────────────────────────────

function relativeDate(isoStr) {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  if (isNaN(then)) return isoStr.slice(0, 10);
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60)          return `${diff}s ago`;
  if (diff < 3600)        return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)       return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7)   return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 30)  return `${Math.floor(diff / (86400 * 7))}w ago`;
  if (diff < 86400 * 365) return `${Math.floor(diff / (86400 * 30))}mo ago`;
  return `${Math.floor(diff / (86400 * 365))}y ago`;
}

// ─── Author Initials ─────────────────────────────────────────────────────────

function authorInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Graph Lane Engine ───────────────────────────────────────────────────────

/**
 * Computes lane assignments for each commit.
 * Returns: array of { commit, laneIdx, lanes (snapshot), mergeFrom }
 */
function buildGraph(commits) {
  // lanes: array of hashes (current "tips" of lanes). null = free slot.
  let lanes = [];
  const result = [];

  for (let ci = 0; ci < commits.length; ci++) {
    const commit = commits[ci];
    const { hash, parents } = commit;

    // Find which lane this commit belongs to
    let myLane = lanes.indexOf(hash);

    if (myLane === -1) {
      // New branch tip — add a new lane
      myLane = lanes.findIndex(l => l === null);
      if (myLane === -1) {
        myLane = lanes.length;
        lanes.push(hash);
      } else {
        lanes[myLane] = hash;
      }
    }

    // Snapshot current lanes for drawing
    const laneSnapshot = lanes.slice();

    // Determine merge connectors: lanes that merge INTO myLane this commit
    const mergeFrom = [];

    // Replace this commit's hash in lanes with its first parent (or null)
    if (parents.length === 0) {
      // Root commit — free the lane
      lanes[myLane] = null;
    } else {
      lanes[myLane] = parents[0];
    }

    // Additional parents (merge commits): find/add lanes for them
    for (let pi = 1; pi < parents.length; pi++) {
      const pHash = parents[pi];
      let pLane = lanes.indexOf(pHash);
      if (pLane === -1) {
        pLane = lanes.findIndex(l => l === null);
        if (pLane === -1) {
          pLane = lanes.length;
          lanes.push(pHash);
        } else {
          lanes[pLane] = pHash;
        }
        mergeFrom.push(pLane);
      } else {
        mergeFrom.push(pLane);
      }
    }

    // Trim trailing nulls
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop();

    result.push({ commit, laneIdx: myLane, lanes: laneSnapshot, mergeFrom });
  }

  return result;
}

// ─── Graph Drawing ───────────────────────────────────────────────────────────

const PIPE    = '│';
const BRANCH  = '├';
const CORNER  = '╮';
const MERGE   = '╯';
const COMMIT  = '●';
const FORK    = '┤';

function renderGraphCell(laneIdx, totalLanes, myLane, mergeFrom) {
  // Returns a string for the graph column (each lane = 2 chars: symbol + space)
  const parts = [];

  for (let i = 0; i < Math.max(totalLanes, myLane + 1); i++) {
    const color = laneColor(i);
    if (i === myLane) {
      parts.push(color + COMMIT + RESET);
    } else if (mergeFrom.includes(i)) {
      parts.push(color + CORNER + RESET);
    } else {
      // Is this lane active in the snapshot?
      if (laneIdx !== null && i < laneIdx) {
        parts.push(laneColor(i) + PIPE + RESET);
      } else {
        parts.push(' ');
      }
    }
    parts.push(' ');
  }

  return parts.join('');
}

function renderConnectorLine(myLane, mergeFrom, totalLanes) {
  // Draw lines connecting merge parents below the commit line
  if (mergeFrom.length === 0) return null;

  const parts = [];
  const activeLanes = new Set([myLane, ...mergeFrom]);

  for (let i = 0; i < Math.max(totalLanes, myLane + 1); i++) {
    const color = laneColor(i);
    if (i === myLane && mergeFrom.some(m => m !== myLane)) {
      parts.push(color + BRANCH + RESET);
    } else if (mergeFrom.includes(i)) {
      parts.push(color + MERGE + RESET);
    } else if (activeLanes.has(i) || i < myLane) {
      parts.push(laneColor(i) + PIPE + RESET);
    } else {
      parts.push(' ');
    }
    parts.push(' ');
  }

  return parts.join('');
}

// ─── Formatting ──────────────────────────────────────────────────────────────

function formatCommitLine(entry, opts) {
  const { commit, laneIdx, lanes, mergeFrom } = entry;
  const { hash, date, author, subject } = commit;
  const totalLanes = lanes.length;

  const graphStr = renderGraphCell(laneIdx, totalLanes, laneIdx, mergeFrom);

  const hashStr    = BOLD + '\x1b[90m' + hash.slice(0, 7) + RESET;
  const dateStr    = DIM + relativeDate(date).padEnd(8) + RESET;
  const initials   = authorInitials(author);
  const aColor     = authorColor(author);
  const authorStr  = aColor + '[' + initials + ']' + RESET;

  const termWidth  = process.stdout.columns || 120;
  const prefixLen  = (totalLanes * 2) + 7 + 1 + 8 + 1 + 4 + 1;
  const msgMax     = Math.max(20, termWidth - prefixLen - 4);
  const msg        = subject.length > msgMax ? subject.slice(0, msgMax - 1) + '…' : subject;

  return graphStr + ' ' + hashStr + ' ' + dateStr + ' ' + authorStr + ' ' + msg;
}

function formatCompactLine(entry) {
  const { commit, laneIdx, lanes, mergeFrom } = entry;
  const { hash, date, author, subject } = commit;
  const totalLanes = lanes.length;

  const graphStr   = renderGraphCell(laneIdx, totalLanes, laneIdx, mergeFrom);
  const hashStr    = '\x1b[90m' + hash.slice(0, 7) + RESET;
  const dateStr    = DIM + relativeDate(date).padEnd(7) + RESET;

  return graphStr + hashStr + ' ' + dateStr + ' ' + subject;
}

// ─── Pager ───────────────────────────────────────────────────────────────────

function runPager(lines) {
  const termHeight = (process.stdout.rows || 40) - 1;
  const totalLines = lines.length;

  if (totalLines <= termHeight) {
    // No pager needed
    for (const line of lines) console.log(line);
    return;
  }

  let offset = 0;

  function render() {
    // Clear screen
    process.stdout.write('\x1b[2J\x1b[H');
    const visible = lines.slice(offset, offset + termHeight - 1);
    for (const line of visible) {
      process.stdout.write(line + '\n');
    }
    const pct = Math.round(((offset + termHeight) / totalLines) * 100);
    process.stdout.write(
      DIM + `-- ${Math.min(pct, 100)}% (j/k: scroll, q: quit) --` + RESET
    );
  }

  render();

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  process.stdin.on('keypress', (str, key) => {
    if (!key) return;

    if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
      process.stdout.write('\n');
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.exit(0);
    } else if (key.name === 'j' || key.name === 'down') {
      if (offset + termHeight < totalLines) {
        offset++;
        render();
      }
    } else if (key.name === 'k' || key.name === 'up') {
      if (offset > 0) {
        offset--;
        render();
      }
    } else if (key.name === 'pagedown' || key.name === 'space') {
      offset = Math.min(offset + termHeight - 1, Math.max(0, totalLines - termHeight));
      render();
    } else if (key.name === 'pageup') {
      offset = Math.max(0, offset - termHeight + 1);
      render();
    } else if (key.name === 'g') {
      offset = 0;
      render();
    } else if (key.name === 'G') {
      offset = Math.max(0, totalLines - termHeight);
      render();
    }
  });

  process.stdin.resume();
}

// ─── Header ──────────────────────────────────────────────────────────────────

function printHeader(opts) {
  const branchRaw = gitExecFile(['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = (branchRaw || '').trim();
  const repoRaw = gitExecFile(['rev-parse', '--show-toplevel']);
  const repo = repoRaw ? repoRaw.trim().split('/').pop() : '';

  const flags = [];
  if (opts.all) flags.push('--all');
  if (opts.author) flags.push(`--author="${opts.author}"`);
  if (opts.since) flags.push(`--since="${opts.since}"`);
  if (opts.search) flags.push(`--search="${opts.search}"`);

  const flagStr = flags.length ? DIM + '  ' + flags.join(' ') + RESET : '';

  return [
    '',
    BOLD + '  git-log-graph' + RESET +
      '  ' + '\x1b[36m' + repo + RESET +
      '  ' + '\x1b[33m' + branch + RESET +
      flagStr,
    DIM + '  ' + '─'.repeat((process.stdout.columns || 80) - 4) + RESET,
    '',
  ];
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (!isGitRepo()) {
    console.error('\x1b[31mError: not inside a git repository.\x1b[0m');
    process.exit(1);
  }

  const commits = fetchLog(opts);

  if (commits.length === 0) {
    console.log(DIM + 'No commits found.' + RESET);
    process.exit(0);
  }

  const graph = buildGraph(commits);

  const outputLines = [];

  // Header
  for (const l of printHeader(opts)) outputLines.push(l);

  // Commits
  for (const entry of graph) {
    if (opts.compact) {
      outputLines.push('  ' + formatCompactLine(entry));
    } else {
      outputLines.push('  ' + formatCommitLine(entry, opts));

      // Merge connector lines
      const connLine = renderConnectorLine(entry.laneIdx, entry.mergeFrom, entry.lanes.length);
      if (connLine) {
        outputLines.push('  ' + connLine);
      }

      // Stat lines
      if (opts.stat) {
        const stats = fetchStat(entry.commit.hash);
        for (const sl of stats) {
          const indent = '  ' + ' '.repeat((entry.lanes.length * 2) + 1);
          outputLines.push(indent + DIM + sl + RESET);
        }
        if (stats.length > 0) outputLines.push('');
      }
    }
  }

  outputLines.push('');

  const termHeight = process.stdout.rows || 40;
  if (outputLines.length > termHeight && process.stdout.isTTY) {
    runPager(outputLines);
  } else {
    for (const line of outputLines) console.log(line);
  }
}

main().catch(err => {
  console.error('\x1b[31mFatal error:\x1b[0m', err.message);
  process.exit(1);
});
