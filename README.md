
# 🐍 Snake API

A lightweight serverless API that dynamically generates GitHub contribution snake SVGs.

Instead of relying on GitHub Actions workflows, this service fetches contribution data from GitHub GraphQL API, generates a custom snake path using pathfinding algorithms, and returns an SVG image directly through an API endpoint.

Because sometimes automation should just… already exist.

---

## 🚀 Features

* Generate GitHub contribution snake SVG on demand
* No GitHub Actions workflow required
* Serverless API architecture
* Uses GitHub GraphQL API
* Custom snake movement algorithm
* BFS-based pathfinding
* Dynamic SVG generation
* Built-in caching support

---

## 📡 Usage

### Endpoint

```

GET /api/snake?user=<github_username>

```

### Example

```

GET /api/snake?user=octocat

````

### Response

Returns an SVG image:

```http
Content-Type: image/svg+xml
````

Example:

```html
<img src="https://your-domain.com/api/snake?user=octocat">
```

---

## 🧠 Why this exists

The traditional GitHub contribution snake usually requires:

* Creating GitHub Actions workflows
* Configuring YAML files
* Waiting for scheduled CI runs
* Debugging permissions and failures

This project takes a different approach:

```
API Request
    ↓
Fetch Contributions
    ↓
Generate Snake
    ↓
Return SVG
```

No workflow setup.
No scheduled jobs.
Just an API call.

---

## ⚙️ How it works

1. Receives a GitHub username from the API request
2. Fetches contribution data using GitHub GraphQL API
3. Converts the contribution calendar into a grid
4. Creates a snake on the generated grid
5. Calculates movement paths using BFS pathfinding
6. Generates an SVG representation
7. Returns the SVG response

Architecture:

```
Client
  |
  | GET /api/snake?user=username
  |
Vercel Serverless Function
  |
  +-- GitHub GraphQL API
  |
  +-- Grid Generator
  |
  +-- Snake Engine
  |
  +-- Pathfinding Algorithm
  |
  +-- SVG Renderer
  |
  V
SVG Response
```

---

## 🧩 Internal Structure

```
src/
├── snakeRunner.js      # Main generation pipeline
├── grid.js             # Contribution grid handling
├── snake.js            # Snake movement logic
├── pathfinding.js      # BFS path search
└── svg.js              # SVG generation
```

---

## 🧮 Algorithm

The snake movement is generated using:

* Grid-based simulation
* BFS (Breadth-First Search) pathfinding
* Contribution data as food positions
* Collision avoidance logic

The snake attempts to navigate through contribution cells while avoiding its own body.

---

## 🧱 Tech Stack

* Next.js
* Vercel Serverless Functions
* Node.js
* GitHub GraphQL API
* SVG generation
* BFS pathfinding algorithm

---

## ⚠️ Notes

* This is not an official GitHub product
* GitHub API rate limits may apply
* Large requests may require caching
* The generated SVG is created dynamically

---

## 🐍 Philosophy

GitHub Actions are great for automation.

But sometimes you don't need a workflow.

Sometimes you just need:

```
GET /api/snake
```

A small API.
A generated SVG.
A snake doing its job.

---

## 📄 License

MIT

