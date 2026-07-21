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
const STEP =
  CELL_SIZE + GAP;

const SNAKE_COLOR =
  "#ffffff";

const SNAKE_LENGTH = 8;

/*
 * 蛇の速度
 *
 * 1秒あたりに進むSVG座標距離。
 */
const SNAKE_SPEED = 55;

/*
 * 蛇がセルを通過した後、
 * セルが消えるまでの遅延。
 */
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
async function getContributions(
  username
) {
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
function createGrid(
  calendar
) {
  const grid = [];

  calendar.weeks.forEach(
    (week, x) => {
      grid[x] = [];

      for (
        let y = 0;
        y < 7;
        y++
      ) {
        grid[x][y] = {
          x,
          y,
          count: 0,
          date: null
        };
      }

      week
        .contributionDays
        .forEach(
          day => {
            grid[x][day.weekday] = {
              x,
              y: day.weekday,
              count:
                day.contributionCount,
              date: day.date
            };
          }
        );
    }
  );

  return grid;
}


/*
 * Snake Path生成
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
function createSnakePath(
  grid
) {
  const path = [];

  for (
    let x = 0;
    x < grid.length;
    x++
  ) {
    const column =
      grid[x];

    if (x % 2 === 0) {
      for (
        let y = 0;
        y < column.length;
        y++
      ) {
        path.push(
          column[y]
        );
      }
    } else {
      for (
        let y =
          column.length - 1;
        y >= 0;
        y--
      ) {
        path.push(
          column[y]
        );
      }
    }
  }

  return path;
}


/*
 * セル → SVG座標
 */
function getPoint(
  cell
) {
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
function distance(
  a,
  b
) {
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
 * パス全体の距離を計算
 */
function getPathLength(
  points
) {
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
 * 各ポイントまでの累積距離
 *
 * 例:
 *
 * point[0] = 0
 * point[1] = 13
 * point[2] = 26
 * point[3] = 39
 */
function getCumulativeDistances(
  points
) {
  const distances = [
    0
  ];

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
function createPath(
  points
) {
  return points
    .map(
      (
        point,
        index
      ) => {
        return `${
          index === 0
            ? "M"
            : "L"
        } ${point.x} ${point.y}`;
      }
    )
    .join(" ");
}


/*
 * XML Escape
 */
function escapeXml(
  value
) {
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
 * SVG属性値用Escape
 */
function escapeAttribute(
  value
) {
  return escapeXml(
    value
  );
}


/*
 * Contribution Cells生成
 */
function createCells(
  grid,
  snakePath,
  cumulativeDistances,
  pathLength,
  oneWayDuration,
  totalDuration
) {
  const cells =
    grid
      .flat()
      .map(
        cell => {
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

          const pathIndex =
            snakePath.findIndex(
              item =>
                item.x ===
                  cell.x &&
                item.y ===
                  cell.y
            );

          if (
            pathIndex === -1
          ) {
            return "";
          }

          /*
           * 蛇の頭がこのセルに到達する
           * までの距離
           */
          const distanceToCell =
            cumulativeDistances[
              pathIndex
            ];

          /*
           * 進行度
           */
          const progress =
            pathLength === 0
              ? 0
              : distanceToCell /
                pathLength;

          /*
           * 往路で頭が到達する時間
           */
          const forwardTime =
            progress *
            oneWayDuration;

          /*
           * 復路
           *
           * 復路では逆順に進むため、
           * このセルに到達する時間は
           * 往路と逆になる。
           */
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

          /*
           * 1周目:
           *
           * 1
           * ↓
           * 蛇が到達
           * ↓
           * 0
           *
           * 2周目:
           *
           * 0
           * ↓
           * 蛇が到達
           * ↓
           * 1
           */
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
      )
      .join("");

  return cells;
}


/*
 * Snake SVG生成
 */
function createSnake(
  path,
  reversePath,
  pathLength,
  oneWayDuration
) {
  const snakeLength =
    SNAKE_LENGTH *
    STEP;

  /*
   * 蛇が1回のアニメーションで
   * 進むべきdashの周期。
   *
   * snakeLength:
   * 表示される蛇の長さ
   *
   * pathLength:
   * 非表示部分
   */
  const dashArray =
    `${snakeLength} ${pathLength}`;

  /*
   * 往路
   */
  const forwardSnake = `
    <path
      id="snake-forward"
      d="${escapeAttribute(
        path
      )}"
      fill="none"
      stroke="${SNAKE_COLOR}"
      stroke-width="7"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-dasharray="${dashArray}"
      stroke-dashoffset="0"
    >
      <animate
        attributeName="stroke-dashoffset"
        dur="${oneWayDuration}s"
        from="0"
        to="-${snakeLength + pathLength}"
        repeatCount="indefinite"
      />
    </path>
  `;

  /*
   * 復路
   */
  const reverseSnake = `
    <path
      id="snake-reverse"
      d="${escapeAttribute(
        reversePath
      )}"
      fill="none"
      stroke="${SNAKE_COLOR}"
      stroke-width="7"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-dasharray="${dashArray}"
      stroke-dashoffset="0"
      opacity="0"
    >
      <animate
        attributeName="opacity"
        dur="${oneWayDuration}s"
        begin="${oneWayDuration}s"
        values="0;1;1;0"
        keyTimes="0;0.001;0.999;1"
        repeatCount="indefinite"
      />

      <animate
        attributeName="stroke-dashoffset"
        dur="${oneWayDuration}s"
        begin="${oneWayDuration}s"
        from="0"
        to="-${snakeLength + pathLength}"
        repeatCount="indefinite"
      />
    </path>
  `;

  /*
   * 頭
   */
  const forwardHead = `
    <circle
      r="5"
      fill="${SNAKE_COLOR}"
    >
      <animateMotion
        dur="${oneWayDuration}s"
        begin="0s"
        repeatCount="indefinite"
        rotate="auto"
        path="${escapeAttribute(
          path
        )}"
      />
    </circle>
  `;

  const reverseHead = `
    <circle
      r="5"
      fill="${SNAKE_COLOR}"
      opacity="0"
    >
      <animate
        attributeName="opacity"
        dur="${oneWayDuration}s"
        begin="${oneWayDuration}s"
        values="0;1;1;0"
        keyTimes="0;0.001;0.999;1"
        repeatCount="indefinite"
      />

      <animateMotion
        dur="${oneWayDuration}s"
        begin="${oneWayDuration}s"
        repeatCount="indefinite"
        rotate="auto"
        path="${escapeAttribute(
          reversePath
        )}"
      />
    </circle>
  `;

  return `
    ${forwardSnake}
    ${reverseSnake}
    ${forwardHead}
    ${reverseHead}
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

  /*
   * 順方向のポイント
   */
  const points =
    snakePath.map(
      getPoint
    );

  /*
   * 逆方向のポイント
   */
  const reversePoints =
    [...points]
      .reverse();

  /*
   * SVG Path
   */
  const path =
    createPath(
      points
    );

  const reversePath =
    createPath(
      reversePoints
    );

  /*
   * 実際のパス長
   */
  const pathLength =
    getPathLength(
      points
    );

  /*
   * 各ポイントまでの距離
   */
  const cumulativeDistances =
    getCumulativeDistances(
      points
    );

  /*
   * 蛇の移動時間
   */
  const oneWayDuration =
    Math.max(
      8,
      pathLength /
        SNAKE_SPEED
    );

  /*
   * 往復
   */
  const totalDuration =
    oneWayDuration *
    2;

  /*
   * Contribution Cells
   */
  const cells =
    createCells(
      grid,
      snakePath,
      cumulativeDistances,
      pathLength,
      oneWayDuration,
      totalDuration
    );

  /*
   * Snake
   */
  const snake =
    createSnake(
      path,
      reversePath,
      pathLength,
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
    /*
     * Contributions取得
     */
    const calendar =
      await getContributions(
        user
      );

    /*
     * Grid生成
     */
    const grid =
      createGrid(
        calendar
      );

    /*
     * Snake Path生成
     */
    const snakePath =
      createSnakePath(
        grid
      );

    /*
     * SVG生成
     */
    const svg =
      createSvg(
        grid,
        snakePath
      );

    /*
     * Response
     */
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
      .send(svg);

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
