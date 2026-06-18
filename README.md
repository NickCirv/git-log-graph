<div align="center">

# git-log-graph

**Colorful ASCII branch graph for `git log` — with author initials, relative dates, and a built-in pager**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue?labelColor=0B0A09)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?labelColor=0B0A09)](package.json)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?labelColor=0B0A09)](package.json)

</div>

## Install

```bash
npx github:NickCirv/git-log-graph
```

Or install globally:

```bash
npm install -g github:NickCirv/git-log-graph
```

## Usage

```bash
git-log-graph [options]
glg [options]          # short alias
```

| Flag | Description |
|------|-------------|
| `--count <n>` | Limit commits shown (default: 100) |
| `--all` | Show all branches |
| `--author <name>` | Filter by author name |
| `--since <date>` | Filter by date, e.g. `"2 weeks ago"` |
| `--search <text>` | Filter commits by message |
| `--stat` | Show files changed per commit |
| `--compact` | One-line-per-commit mode |
| `--help, -h` | Show help |

**Examples:**

```bash
glg --all --author "Jane" --since "2 weeks ago"
glg --search "feat" --stat
glg --compact --count 50
```

## What it does

Runs `git log` and renders your branch history as a colored ASCII graph — each active branch gets its own ANSI lane color, commits show author initials (`[JD]`) color-coded per contributor, and dates display as human-friendly relative values (`2h ago`, `3d ago`). Merge points are connected with `╮`/`╯` line-drawing characters. When output exceeds the terminal height, a built-in pager activates (j/k to scroll, q to quit).

---

<sub>Zero dependencies · Node 18+ · MIT · by <a href="https://github.com/NickCirv">NickCirv</a></sub>
