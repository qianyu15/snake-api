// pages/api/snake.js

const GITHUB_API = "https://api.github.com/graphql";

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

/*
 * 本家のアニメーションは、
 * すべてのセルを順番にたどる。
 *
 * 1セルごとのアニメーション時間。
 */
const CELL_DURATION = 0.035;

/*
 * 蛇の長さ。
 *
 * 本家のように「頭だけ」ではなく、
 * 一定長の胴体を持つ。
 */
const SNAKE_LENGTH = 8;

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

  const response = await fetch(
    GITHUB_API,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        Authorization:
          \`Bearer \${token}\`
      },

      body: JSON.stringify({
        query,

        variables: {
          login: username
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      \`GitHub API returned \${response.status}\`
    );
  }

  const data =
    await response.json();

  if (data.errors) {
    throw new Error(
      data.errors
        .map(error => error.message)
        .join(", ")
    );
  }

  const calendar =
    data.data
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

function createGrid(calendar) {
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

      week.contributionDays
        .forEach(day => {
          grid[x][day.weekday] = {
            x,
            y: day.weekday,
            count:
              day.contributionCount,
            date: day.date
          };
        });
    }
  );

  return grid;
}

/*
 * 蛇の経路
 *
 * 縦方向に進み、
 * 列の終端で折り返す。
 *
 * 例:
 *
 * ↓
 * ↓
 * ↓
 * ↓
 * ↓ →
 * ↑
 * ↑
 * ↑
 * ↑
 * ↑ →
 * ↓
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
 * すべてのセルの中心座標を作る
 */
function getPoint(cell) {
  return {
    x:
      cell.x * STEP +
      CELL_SIZE / 2,

    y:
      cell.y * STEP +
      CELL_SIZE / 2
  };
}

/*
 * SVG pathを作る
 */
function createPath(points) {
  return points
    .map(
      (point, index) =>
        \`\${index === 0 ? "M" : "L"} \${point.x} \${point.y}\`
    )
    .join(" ");
}

/*
 * 蛇の本体を作る
 *
 * 本家のように、
 * 蛇は1本の線ではなく
 * 一定長の「頭 + 胴体」として
 * パスを移動する。
 */
function createSnakeAnimation(
  snakePath,
  pathId,
  duration,
  reverse = false
) {
  const points =
    snakePath.map(
      getPoint
    );

  const path =
    createPath(points);

  const totalLength =
    points.length * STEP;

  const start =
    reverse
      ? totalLength
      : 0;

  const end =
    reverse
      ? 0
      : totalLength;

  /*
   * SVGのstroke-dasharrayで
   * 蛇の長さだけを表示する。
   *
   * 重要:
   *
   * 以前のコードの
   *
   * stroke-dasharray: 35 100000
   *
   * ではなく、
   *
   * 蛇の長さ + 残りの経路
   *
   * を正確に指定する。
   */
  const snakeLength =
    SNAKE_LENGTH * STEP;

  return {
    path,

    snakeLength,

    start,

    end,

    duration
  };
}

function createSvg(
  grid,
  snakePath
) {
  const columns =
    grid.length;

  const rows = 7;

  const width =
    columns * STEP;

  const height =
    rows * STEP;

  /*
   * 1周分の時間
   */
  const oneWayDuration =
    Math.max(
      8,
      snakePath.length *
        CELL_DURATION
    );

  /*
   * 往復
   */
  const totalDuration =
    oneWayDuration * 2;

  /*
   * Contribution Grid
   */
  const cells =
    grid
      .flat()
      .map(cell => {
        const x =
          cell.x * STEP;

        const y =
          cell.y * STEP;

        const color =
          COLORS[
            getLevel(
              cell.count
            )
          ];

        /*
         * 各セルを
         * 蛇の頭が通過するタイミングで
         * 消す。
         *
         * 逆方向では再び表示する。
         */
        const pathIndex =
          snakePath.findIndex(
            item =>
              item.x === cell.x &&
              item.y === cell.y
          );

        const forwardStart =
          pathIndex *
          CELL_DURATION;

        const forwardEnd =
          forwardStart +
          CELL_DURATION;

        const reverseStart =
          oneWayDuration +
          (snakePath.length -
            pathIndex -
            1) *
            CELL_DURATION;

        const reverseEnd =
          reverseStart +
          CELL_DURATION;

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
                ${forwardStart / totalDuration};
                ${forwardEnd / totalDuration};
                ${reverseStart / totalDuration};
                ${reverseEnd / totalDuration};
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
      })
      .join("");

  /*
   * 蛇の経路
   */
  const points =
    snakePath.map(
      getPoint
    );

  const snakeD =
    createPath(points);

  /*
   * 蛇の長さ
   */
  const snakeLength =
    SNAKE_LENGTH * STEP;

  /*
   * 蛇本体
   *
   * stroke-dasharrayで
   * 「蛇の長さ」だけを表示する。
   */
  const snake = `
    <path
      id="snake-path"
      d="${escapeXml(
        snakeD
      )}"
      fill="none"
      stroke="${SNAKE_COLOR}"
      stroke-width="7"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-dasharray="
        ${snakeLength}
        ${snakeLength}
      "
      stroke-dashoffset="0"
    >
      <animate
        attributeName="stroke-dashoffset"
        dur="${oneWayDuration}s"
        values="
          0;
          -${snakePath.length * STEP}
        "
        begin="0s"
        repeatCount="1"
        fill="freeze"
      />

      <animate
        attributeName="stroke-dashoffset"
        dur="${oneWayDuration}s"
        values="
          -${snakePath.length * STEP};
          0
        "
        begin="${oneWayDuration}s"
        repeatCount="indefinite"
      />
    </path>
  `;

  /*
   * 蛇の頭
   *
   * パスに沿って移動する。
   */
  const head = `
    <circle
      r="5"
      fill="${SNAKE_COLOR}"
    >
      <animateMotion
        dur="${oneWayDuration}s"
        repeatCount="indefinite"
        rotate="auto"
        path="${escapeXml(
          snakeD
        )}"
      />
    </circle>
  `;

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
      transform-box:
        fill-box;

      transform-origin:
        center;
    }
  </style>

  ${cells}

  ${snake}

  ${head}

</svg>
`.trim();
}

export default async function handler(
  req,
  res
) {
  const {
    user
  } = req.query;

  if (
    !user ||
    typeof user !== "string"
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
