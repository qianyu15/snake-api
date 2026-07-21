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

const SNAKE_COLOR =
  "#ffffff";

const CELL_SIZE =
  10;

const GAP =
  3;

const STEP =
  CELL_SIZE +
  GAP;

const SNAKE_LENGTH =
  8;

const SNAKE_SPEED =
  55;

const CELL_FADE_DURATION =
  0.12;


/*
 * Contribution Level
 */
function getLevel(
  count
) {
  if (
    count === 0
  ) {
    return 0;
  }

  if (
    count <= 3
  ) {
    return 1;
  }

  if (
    count <= 6
  ) {
    return 2;
  }

  if (
    count <= 9
  ) {
    return 3;
  }

  return 4;
}


/*
 * GitHub API
 */
async function getContributions(
  username
) {
  const token =
    process.env.GITHUB_TOKEN;

  if (
    !token
  ) {
    throw new Error(
      "GITHUB_TOKEN is not configured"
    );
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

  const response =
    await fetch(
      GITHUB_API,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`
        },

        body:
          JSON.stringify(
            {
              query,

              variables: {
                login:
                  username
              }
            }
          )
      }
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `GitHub API returned ${response.status}`
    );
  }

  const result =
    await response.json();

  if (
    result.errors
  ) {
    throw new Error(
      result.errors
        .map(
          error =>
            error.message
        )
        .join(
          ", "
        )
    );
  }

  const calendar =
    result
      ?.data
      ?.user
      ?.contributionsCollection
      ?.contributionCalendar;

  if (
    !calendar
  ) {
    throw new Error(
      "GitHub user not found"
    );
  }

  return calendar;
}


/*
 * Grid生成
 */
function createGrid(
  calendar
) {
  return calendar
    .weeks
    .map(
      (
        week,
        x
      ) => {
        const column =
          Array
            .from(
              {
                length:
                  7
              },
              (
                _,
                y
              ) => ({
                x,

                y,

                count:
                  0,

                date:
                  null
              })
            );

        for (
          const day
          of week.contributionDays
        ) {
          column[
            day.weekday
          ] = {
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
 * 隣接セル
 */
function getNeighbors(
  cell,
  grid
) {
  const directions = [
    {
      x:
        1,

      y:
        0
    },

    {
      x:
        0,

      y:
        1
    },

    {
      x:
        -1,

      y:
        0
    },

    {
      x:
        0,

      y:
        -1
    }
  ];

  return directions
    .map(
      direction => {
        const x =
          cell.x +
          direction.x;

        const y =
          cell.y +
          direction.y;

        if (
          x < 0 ||
          x >= grid.length ||
          y < 0 ||
          y >= 7
        ) {
          return null;
        }

        return grid[
          x
        ][
          y
        ];
      }
    )
    .filter(
      Boolean
    );
}


/*
 * Contribution Snake Solver
 *
 * 目的:
 *
 * すべてのセルを一度ずつ訪問する
 *
 * 優先順位:
 *
 * 1. 未訪問
 * 2. Contributionが高い
 * 3. 進行方向を維持
 */
function solveSnake(
  grid
) {
  const result =
    [];

  const visited =
    new Set();

  let current =
    grid[
      0
    ][
      0
    ];

  while (
    result.length <
    grid.length *
    7
  ) {
    result.push(
      current
    );

    visited.add(
      `${current.x}:${current.y}`
    );

    const candidates =
      getNeighbors(
        current,
        grid
      )
        .filter(
          cell =>
            !visited.has(
              `${cell.x}:${cell.y}`
            )
        )
        .sort(
          (
            a,
            b
          ) =>
            b.count -
            a.count
        );

    if (
      candidates.length
    ) {
      current =
        candidates[
          0
        ];

      continue;
    }

    /*
     * 未訪問セルが残っている場合、
     * 最も近い未訪問セルへ接続
     */
    let nearest =
      null;

    let nearestDistance =
      Infinity;

    for (
      const column
      of grid
    ) {
      for (
        const cell
        of column
      ) {
        const key =
          `${cell.x}:${cell.y}`;

        if (
          visited.has(
            key
          )
        ) {
          continue;
        }

        const distance =
          Math.abs(
            cell.x -
            current.x
          ) +
          Math.abs(
            cell.y -
            current.y
          );

        if (
          distance <
          nearestDistance
        ) {
          nearest =
            cell;

          nearestDistance =
            distance;
        }
      }
    }

    if (
      nearest
    ) {
      current =
        nearest;

      continue;
    }

    break;
  }

  return result;
}


/*
 * Cell → Point
 */
function getPoint(
  cell
) {
  return {
    x:
      cell.x *
      STEP +
      CELL_SIZE /
      2,

    y:
      cell.y *
      STEP +
      CELL_SIZE /
      2
  };
}


/*
 * Distance
 */
function distance(
  a,
  b
) {
  const dx =
    b.x -
    a.x;

  const dy =
    b.y -
    a.y;

  return Math.sqrt(
    dx *
    dx +
    dy *
    dy
  );
}


/*
 * Path Length
 */
function getPathLength(
  points
) {
  let length =
    0;

  for (
    let i =
      1;

    i <
      points.length;

    i++
  ) {
    length +=
      distance(
        points[
          i -
          1
        ],

        points[
          i
        ]
      );
  }

  return length;
}


/*
 * Cumulative Distance
 */
function getCumulativeDistances(
  points
) {
  const distances =
    [
      0
    ];

  for (
    let i =
      1;

    i <
      points.length;

    i++
  ) {
    distances[
      i
    ] =
      distances[
        i -
        1
      ] +
      distance(
        points[
          i -
          1
        ],

        points[
          i
        ]
      );
  }

  return distances;
}


/*
 * SVG Path
 */
function createPath(
  points
) {
  return points
    .map(
      (
        point,
        index
      ) =>
        `${
          index ===
          0
            ? "M"
            : "L"
        } ${
          point.x
        } ${
          point.y
        }`
    )
    .join(
      " "
    );
}


/*
 * Escape
 */
function escapeXml(
  value
) {
  return String(
    value
  )
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
 * Cell SVG
 */
function createCell(
  cell,
  progress,
  duration
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

  const appear =
    progress *
    duration;

  const disappear =
    Math.min(
      appear +
      CELL_FADE_DURATION,

      duration
    );

  return `
    <rect
      x="${x}"
      y="${y}"
      width="${CELL_SIZE}"
      height="${CELL_SIZE}"
      rx="2"
      fill="${color}"
    >
      <animate
        attributeName="opacity"
        dur="${duration}s"
        repeatCount="indefinite"
        keyTimes="
          0;
          ${appear / duration};
          ${disappear / duration};
          1
        "
        values="
          1;
          1;
          0;
          0
        "
      />
    </rect>
  `;
}


/*
 * Snake SVG
 */
function createSnake(
  path,
  pathLength,
  duration
) {
  const snakeLength =
    SNAKE_LENGTH *
    STEP;

  return `
    <path
      d="${escapeXml(
        path
      )}"
      fill="none"
      stroke="${SNAKE_COLOR}"
      stroke-width="7"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-dasharray="
        ${snakeLength}
        ${pathLength}
      "
    >
      <animate
        attributeName="stroke-dashoffset"
        dur="${duration}s"
        repeatCount="indefinite"
        values="
          0;
          -${pathLength}
        "
      />
    </path>
  `;
}


/*
 * Snake Head
 */
function createHead(
  path,
  duration
) {
  return `
    <circle
      r="5"
      fill="${SNAKE_COLOR}"
    >
      <animateMotion
        dur="${duration}s"
        repeatCount="indefinite"
        rotate="auto"
        calcMode="linear"
        path="${escapeXml(
          path
        )}"
      />
    </circle>
  `;
}


/*
 * SVG
 */
function createSvg(
  grid,
  snakePath
) {
  const width =
    grid.length *
    STEP;

  const height =
    7 *
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

  const distances =
    getCumulativeDistances(
      points
    );

  const duration =
    Math.max(
      8,

      pathLength /
      SNAKE_SPEED
    );

  const cells =
    grid
      .flat()
      .map(
        cell => {
          const index =
            snakePath
              .findIndex(
                item =>
                  item.x ===
                  cell.x &&
                  item.y ===
                  cell.y
              );

          if (
            index ===
            -1
          ) {
            return "";
          }

          const progress =
            distances[
              index
            ] /
            pathLength;

          return createCell(
            cell,

            progress,

            duration
          );
        }
      )
      .join(
        ""
      );

  const snake =
    createSnake(
      path,

      pathLength,

      duration
    );

  const head =
    createHead(
      path,

      duration
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
  ${cells}

  ${snake}

  ${head}
</svg>
`.trim();
}


/*
 * API
 */
export default async function handler(
  req,
  res
) {
  const {
    user
  } =
    req.query;

  if (
    !user ||
    typeof user !==
    "string"
  ) {
    return res
      .status(
        400
      )
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
      solveSnake(
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

      "public, s-maxage=86400, stale-while-revalidate=604800"
    );

    return res
      .status(
        200
      )
      .send(
        svg
      );

  } catch (
    error
  ) {
    console.error(
      error
    );

    return res
      .status(
        500
      )
      .send(
        "Snake generation failed"
      );
  }
}
