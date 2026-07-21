// pages/api/snake.js

const GITHUB_API =
  "https://api.github.com/graphql";

const COLORS = [
  "#161b22",
  "#0e4429",
  "#006d32",
  "#26a641",
  "#39d353"
];

const CELL_SIZE = 10;
const GAP = 3;
const STEP = CELL_SIZE + GAP;

const SNAKE_COLOR = "#ffffff";

const SNAKE_LENGTH = 8;

const SNAKE_SPEED = 55;

const CELL_FADE_DURATION = 0.08;


/*
 * Contribution Level
 */
function getLevel(count) {
  if (count === 0) {
    return 0;
  }

  if (count <= 3) {
    return 1;
  }

  if (count <= 6) {
    return 2;
  }

  if (count <= 9) {
    return 3;
  }

  return 4;
}


/*
 * GitHub Contributions取得
 */
async function getContributions(username) {
  const token =
    process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not configured"
    );
  }

  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
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

  const response =
    await fetch(
      GITHUB_API,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`
        },

        body:
          JSON.stringify({
            query,

            variables: {
              login: username
            }
          })
        }
      );

  if (!response.ok) {
    throw new Error(
      `GitHub API returned ${response.status}`
    );
  }

  const data =
    await response.json();

  if (data.errors) {
    throw new Error(
      data.errors
        .map(
          error =>
            error.message
        )
        .join(", ")
    );
  }

  const calendar =
    data
      ?.data
      ?.user
      ?.contributionsCollection
      ?.contributionCalendar;

  if (!calendar) {
    throw new Error(
      "GitHub user not found"
    );
  }

  return calendar;
}


/*
 * Contribution Grid生成
 */
function createGrid(calendar) {
  return calendar.weeks.map(
    (week, x) => {
      const column =
        Array.from(
          {
            length: 7
          },
          (_, y) => ({
            x,
            y,
            count: 0,
            date: null
          })
        );

      for (
        const day
        of week.contributionDays
      ) {
        column[day.weekday] = {
          x,

          y:
            day.weekday,

          count:
            day.contributionCount,

          date:
            day.date
        };
      }

      return column;
    }
  );
}


/*
 * Serpentine Path
 *
 * ↓
 * ↓
 * ↓
 * ↓
 * ↓
 * ↓
 * ↓ →
 *
 * ↑
 * ↑
 * ↑
 * ↑
 * ↑
 * ↑
 * ↑ →
 */
function createSnakePath(grid) {
  const path = [];

  for (
    let x = 0;
    x < grid.length;
    x++
  ) {
    const column =
      grid[x];

    if (x % 2 === 0) {
      path.push(
        ...column
      );
    } else {
      path.push(
        ...column
          .slice()
          .reverse()
      );
    }
  }

  return path;
}


/*
 * Cell → SVG Point
 */
function getPoint(cell) {
  return {
    x:
      cell.x *
        STEP +
      CELL_SIZE / 2,

    y:
      cell.y *
        STEP +
      CELL_SIZE / 2
  };
}


/*
 * 2点間の距離
 */
function distance(a, b) {
  const dx =
    b.x - a.x;

  const dy =
    b.y - a.y;

  return Math.sqrt(
    dx * dx +
    dy * dy
  );
}


/*
 * Pathの長さ
 */
function getPathLength(points) {
  let length = 0;

  for (
    let i = 1;
    i < points.length;
    i++
  ) {
    length +=
      distance(
        points[i - 1],
        points[i]
      );
  }

  return length;
}


/*
 * 各Pointまでの累積距離
 */
function getCumulativeDistances(points) {
  const distances = [0];

  for (
    let i = 1;
    i < points.length;
    i++
  ) {
    distances[i] =
      distances[i - 1] +
      distance(
        points[i - 1],
        points[i]
      );
  }

  return distances;
}


/*
 * SVG Path生成
 */
function createPath(points) {
  return points
    .map(
      (
        point,
        index
      ) =>
        `${
          index === 0
            ? "M"
            : "L"
        } ${point.x} ${point.y}`
    )
    .join(" ");
}


/*
 * XML Escape
 */
function escapeXml(value) {
  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&apos;"
    );
}


/*
 * Cell Animation
 */
function createCell(
  cell,
  pathIndex,
  cumulativeDistances,
  pathLength,
  oneWayDuration,
  totalDuration
) {
  const x =
    cell.x *
    STEP;

  const y =
    cell.y *
    STEP;

  const color =
    COLORS[
      getLevel(
        cell.count
      )
    ];

  const distanceToCell =
    cumulativeDistances[
      pathIndex
    ];

  const progress =
    pathLength === 0
      ? 0
      : distanceToCell /
        pathLength;

  const forwardTime =
    progress *
    oneWayDuration;

  const reverseTime =
    oneWayDuration +
    (
      1 -
      progress
    ) *
    oneWayDuration;

  const forwardFadeEnd =
    Math.min(
      forwardTime +
        CELL_FADE_DURATION,

      oneWayDuration
    );

  const reverseFadeEnd =
    Math.min(
      reverseTime +
        CELL_FADE_DURATION,

      totalDuration
    );

  return `
    <rect
      class="cell"
      x="${x}"
      y="${y}"
      width="${CELL_SIZE}"
      height="${CELL_SIZE}"
      rx="2"
      fill="${color}"
    >
      <animate
        attributeName="opacity"
        dur="${totalDuration}s"
        repeatCount="indefinite"
        calcMode="linear"
        keyTimes="
          0;
          ${forwardTime / totalDuration};
          ${forwardFadeEnd / totalDuration};
          ${reverseTime / totalDuration};
          ${reverseFadeEnd / totalDuration};
          1
        "
        values="
          1;
          1;
          0;
          0;
          1;
          1
        "
      />
    </rect>
  `;
}


/*
 * Contribution Cells
 */
function createCells(
  grid,
  snakePath,
  cumulativeDistances,
  pathLength,
  oneWayDuration,
  totalDuration
) {
  const indexMap =
    new Map();

  snakePath.forEach(
    (
      cell,
      index
    ) => {
      indexMap.set(
        `${cell.x}:${cell.y}`,
        index
      );
    }
  );

  return grid
    .flat()
    .map(
      cell => {
        const pathIndex =
          indexMap.get(
            `${cell.x}:${cell.y}`
          );

        if (
          pathIndex ===
          undefined
        ) {
          return "";
        }

        return createCell(
          cell,

          pathIndex,

          cumulativeDistances,

          pathLength,

          oneWayDuration,

          totalDuration
        );
      }
    )
    .join("");
}


/*
 * Snake本体
 *
 * dasharray:
 *
 * [蛇の長さ] [残りのパス]
 *
 * dashoffset:
 *
 * 0
 * ↓
 * -pathLength
 * ↓
 * 0
 */
function createSnake(
  path,
  pathLength,
  oneWayDuration
) {
  const snakeLength =
    SNAKE_LENGTH *
    STEP;

  const totalDuration =
    oneWayDuration *
    2;

  return `
    <path
      d="${escapeXml(path)}"
      fill="none"
      stroke="${SNAKE_COLOR}"
      stroke-width="7"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-dasharray="
        ${snakeLength}
        ${pathLength}
      "
      stroke-dashoffset="0"
    >
      <animate
        attributeName="stroke-dashoffset"
        dur="${totalDuration}s"
        repeatCount="indefinite"
        calcMode="linear"
        keyTimes="
          0;
          0.5;
          1
        "
        values="
          0;
          -${pathLength};
          0
        "
      />
    </path>
  `;
}


/*
 * Snake Head
 */
function createSnakeHead(
  path,
  oneWayDuration
) {
  const totalDuration =
    oneWayDuration *
    2;

  return `
    <circle
      r="5"
      fill="${SNAKE_COLOR}"
    >
      <animateMotion
        dur="${totalDuration}s"
        repeatCount="indefinite"
        rotate="auto"
        calcMode="linear"
        keyPoints="
          0;
          1;
          0
        "
        keyTimes="
          0;
          0.5;
          1
        "
        path="${escapeXml(path)}"
      />
    </circle>
  `;
}


/*
 * SVG生成
 */
function createSvg(
  grid,
  snakePath
) {
  const columns =
    grid.length;

  const rows =
    7;

  const width =
    columns *
    STEP;

  const height =
    rows *
    STEP;

  const points =
    snakePath.map(
      getPoint
    );

  const path =
    createPath(
      points
    );

  const pathLength =
    getPathLength(
      points
    );

  const cumulativeDistances =
    getCumulativeDistances(
      points
    );

  const oneWayDuration =
    Math.max(
      8,

      pathLength /
        SNAKE_SPEED
    );

  const totalDuration =
    oneWayDuration *
    2;

  const cells =
    createCells(
      grid,

      snakePath,

      cumulativeDistances,

      pathLength,

      oneWayDuration,

      totalDuration
    );

  const snake =
    createSnake(
      path,

      pathLength,

      oneWayDuration
    );

  const head =
    createSnakeHead(
      path,

      oneWayDuration
    );

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
  role="img"
  aria-label="GitHub contribution snake"
>
  <style>
    .cell {
      shape-rendering:
        geometricPrecision;
    }
  </style>

  ${cells}

  ${snake}

  ${head}

</svg>
`.trim();
}


/*
 * API Handler
 */
export default async function handler(
  req,
  res
) {
  const {
    user
  } = req.query;

  if (
    !user ||
    typeof user !==
      "string"
  ) {
    return res
      .status(400)
      .send(
        "Missing user"
      );
  }

  try {
    const calendar =
      await getContributions(
        user
      );

    const grid =
      createGrid(
        calendar
      );

    const snakePath =
      createSnakePath(
        grid
      );

    const svg =
      createSvg(
        grid,

        snakePath
      );

    res.setHeader(
      "Content-Type",

      "image/svg+xml; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",

      [
        "public",
        "s-maxage=86400",
        "stale-while-revalidate=604800"
      ].join(", ")
    );

    return res
      .status(200)
      .send(
        svg
      );

  } catch (error) {
    console.error(
      "Snake generation failed:",

      error
    );

    return res
      .status(500)
      .send(
        "Snake generation failed"
      );
  }
}
