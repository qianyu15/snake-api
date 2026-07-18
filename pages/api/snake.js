// pages/api/snake.js

const GITHUB_API = "https://api.github.com/graphql";

const COLORS = [
  "#161b22",
  "#0e4429",
  "#006d32",
  "#26a641",
  "#39d353"
];

function getLevel(count) {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  return 4;
}

async function getContributions(username) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured");
  }

  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionCount
                date
                weekday
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch(GITHUB_API, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },

    body: JSON.stringify({
      query,
      variables: {
        login: username
      }
    })
  });

  const data = await response.json();

  if (data.errors) {
    throw new Error(
      data.errors
        .map(error => error.message)
        .join(", ")
    );
  }

  const calendar =
    data.data?.user?.contributionsCollection
      ?.contributionCalendar;

  if (!calendar) {
    throw new Error("GitHub user not found");
  }

  return calendar;
}

function createGrid(calendar) {
  const grid = [];

  for (let x = 0; x < 53; x++) {
    grid[x] = [];

    for (let y = 0; y < 7; y++) {
      grid[x][y] = {
        x,
        y,
        count: 0,
        date: null
      };
    }
  }

  calendar.weeks.forEach((week, x) => {
    if (x >= 53) return;

    week.contributionDays.forEach(day => {
      grid[x][day.weekday] = {
        x,
        y: day.weekday,
        count: day.contributionCount,
        date: day.date
      };
    });
  });

  return grid;
}

function createSnakePath(grid) {
  const path = [];

  for (let x = 0; x < grid.length; x++) {
    if (x % 2 === 0) {
      for (let y = 0; y < 7; y++) {
        path.push(grid[x][y]);
      }
    } else {
      for (let y = 6; y >= 0; y--) {
        path.push(grid[x][y]);
      }
    }
  }

  return path;
}

function createSvg(grid, snakePath) {
  const cellSize = 12;
  const gap = 3;

  const width = 53 * (cellSize + gap);
  const height = 7 * (cellSize + gap);

  const cells = grid
    .flat()
    .map(cell => {
      const x = cell.x * (cellSize + gap);
      const y = cell.y * (cellSize + gap);

      const color =
        COLORS[getLevel(cell.count)];

      return `
        <rect
          x="${x}"
          y="${y}"
          width="${cellSize}"
          height="${cellSize}"
          rx="2"
          fill="${color}"
        />
      `;
    })
    .join("");

  const path = snakePath
    .map((cell, index) => {
      const x =
        cell.x * (cellSize + gap) +
        cellSize / 2;

      const y =
        cell.y * (cellSize + gap) +
        cellSize / 2;

      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>
  <style>
    .snake {
      fill: none;
      stroke: #ffffff;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  </style>

  ${cells}

  <path
    class="snake"
    d="${path}"
  />
</svg>
`.trim();
}

export default async function handler(req, res) {
  const { user } = req.query;

  if (!user || typeof user !== "string") {
    return res.status(400).send("Missing user");
  }

  try {
    const calendar =
      await getContributions(user);

    const grid =
      createGrid(calendar);

    const snakePath =
      createSnakePath(grid);

    const svg =
      createSvg(grid, snakePath);

    res.setHeader(
      "Content-Type",
      "image/svg+xml; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=86400, stale-while-revalidate=604800"
    );

    return res
      .status(200)
      .send(svg);

  } catch (error) {
    console.error(
      "Snake generation failed:",
      error
    );

    return res
      .status(500)
      .send("Snake generation failed");
  }
}
