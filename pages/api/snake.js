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

  if (!response.ok) {
    throw new Error(
      `GitHub API returned ${response.status}`
    );
  }

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

  calendar.weeks.forEach((week, x) => {
    grid[x] = [];

    for (let y = 0; y < 7; y++) {
      grid[x][y] = {
        x,
        y,
        count: 0,
        date: null
      };
    }

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

/*
 * 蛇の移動経路を作る
 *
 * ↓
 * ↓
 * ↓
 * ↓
 * ↓ →
 * ↑
 * ↑
 * ↑
 * ↑ →
 * ↓
 *
 * のような蛇行経路。
 */
function createSnakePath(grid) {
  const path = [];

  for (let x = 0; x < grid.length; x++) {
    const column = grid[x];

    if (x % 2 === 0) {
      for (let y = 0; y < column.length; y++) {
        path.push(column[y]);
      }
    } else {
      for (let y = column.length - 1; y >= 0; y--) {
        path.push(column[y]);
      }
    }
  }

  return path;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createSvg(grid, snakePath) {
  const cellSize = 10;
  const gap = 3;
  const step = cellSize + gap;

  const columns = grid.length;
  const rows = 7;

  const width = columns * step;
  const height = rows * step;

  /*
   * 蛇の長さ
   */
  const SNAKE_LENGTH = 8;

  /*
   * 1セル移動する時間
   */
  const STEP_TIME = 40;

  /*
   * Contribution Grid
   */
  const cells = grid
    .flat()
    .map(cell => {
      const x = cell.x * step;
      const y = cell.y * step;

      const color =
        COLORS[getLevel(cell.count)];

      return `
        <rect
          class="cell cell-${cell.x}-${cell.y}"
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

  /*
   * 蛇が通る全座標
   *
   * SVG上の座標に変換する。
   */
  const points = snakePath.map(cell => ({
    x: cell.x * step + cellSize / 2,
    y: cell.y * step + cellSize / 2
  }));

  /*
   * JavaScriptに渡すための座標データ
   */
  const serializedPoints =
    JSON.stringify(points);

  /*
   * 蛇の頭と胴体
   */
  const snakeParts = Array.from(
    {
      length: SNAKE_LENGTH
    },
    (_, index) => `
      <circle
        class="snake-part snake-part-${index}"
        r="${index === 0 ? 5 : 4}"
      />
    `
  ).join("");

  /*
   * セルを食べるアニメーション
   */
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
      transform-box: fill-box;
      transform-origin: center;
    }

    .snake-part {
      fill: #ffffff;
      pointer-events: none;
    }

    .snake-part-0 {
      fill: #ffffff;
    }

    .eaten {
      animation:
        eat-cell
        0.2s
        ease-out
        forwards;
    }

    @keyframes eat-cell {
      0% {
        opacity: 1;
        transform: scale(1);
      }

      100% {
        opacity: 0;
        transform: scale(0.15);
      }
    }
  </style>

  <!-- Contribution Grid -->
  ${cells}

  <!-- Snake -->
  <g id="snake">
    ${snakeParts}
  </g>

  <script>
    <![CDATA[

    /*
     * 蛇の経路
     */
    const path =
      ${serializedPoints};

    /*
     * 蛇の長さ
     */
    const SNAKE_LENGTH =
      ${SNAKE_LENGTH};

    /*
     * 1セルの移動時間
     */
    const STEP_TIME =
      ${STEP_TIME};

    /*
     * 蛇のパーツ
     */
    const parts =
      Array.from(
        document.querySelectorAll(
          ".snake-part"
        )
      );

    /*
     * 元のセル座標
     *
     * 蛇が食べるセルを
     * JavaScriptから検索するために使う。
     */
    const cells = ${JSON.stringify(
      snakePath.map(cell => ({
        x: cell.x,
        y: cell.y
      }))
    )};

    /*
     * 1:
     *   左から右へ進む
     *
     * -1:
     *   右から左へ戻る
     */
    let direction = 1;

    /*
     * 蛇の頭の位置
     */
    let headIndex = 0;

    /*
     * アニメーション開始時間
     */
    let startTime = null;

    /*
     * 現在の蛇の位置にあるセルを食べる
     */
    function eatCell(index) {
      const cell = cells[index];

      if (!cell) {
        return;
      }

      const selector =
        ".cell-" +
        cell.x +
        "-" +
        cell.y;

      const element =
        document.querySelector(selector);

      if (!element) {
        return;
      }

      if (
        element.classList.contains(
          "eaten"
        )
      ) {
        return;
      }

      element.classList.add(
        "eaten"
      );
    }

    /*
     * 蛇の位置を更新する
     */
    function updateSnake(currentIndex) {
      parts.forEach(
        (part, index) => {
          /*
           * 頭から後ろに行くほど
           * 過去の位置を使う。
           */
          const position =
            currentIndex -
            index * direction;

          /*
           * 経路外
           */
          if (
            position < 0 ||
            position >= path.length
          ) {
            part.style.display =
              "none";

            return;
          }

          part.style.display =
            "block";

          /*
           * 現在位置の前後の点
           */
          const fromIndex =
            Math.floor(position);

          const toIndex =
            Math.min(
              Math.ceil(position),
              path.length - 1
            );

          const from =
            path[fromIndex];

          const to =
            path[toIndex];

          /*
           * セル間の移動割合
           */
          const ratio =
            position - fromIndex;

          /*
           * 線形補間
           */
          const x =
            from.x +
            (to.x - from.x) *
            ratio;

          const y =
            from.y +
            (to.y - from.y) *
            ratio;

          part.setAttribute(
            "cx",
            x
          );

          part.setAttribute(
            "cy",
            y
          );
        }
      );
    }

    /*
     * すべてのセルを復活
     */
    function resetCells() {
      document
        .querySelectorAll(".cell")
        .forEach(cell => {
          cell.classList.remove(
            "eaten"
          );
        });
    }

    /*
     * メインアニメーション
     */
    function animate(timestamp) {
      if (!startTime) {
        startTime =
          timestamp;
      }

      /*
       * 経過時間
       */
      const elapsed =
        timestamp -
        startTime;

      /*
       * 現在の蛇の位置
       *
       * 0.0
       * 0.5
       * 1.0
       * 1.5
       *
       * のように小数で進む。
       */
      const progress =
        elapsed /
        STEP_TIME;

      const currentIndex =
        headIndex +
        progress *
        direction;

      /*
       * 頭が通過したセルを食べる
       */
      const eatenIndex =
        Math.floor(
          currentIndex
        );

      if (
        eatenIndex >= 0 &&
        eatenIndex < path.length
      ) {
        eatCell(
          eatenIndex
        );
      }

      /*
       * 蛇を移動
       */
      updateSnake(
        currentIndex
      );

      /*
       * 順方向の終端
       */
      if (
        direction === 1 &&
        currentIndex >=
          path.length - 1
      ) {
        headIndex =
          path.length - 1;

        direction =
          -1;

        startTime =
          timestamp;

        requestAnimationFrame(
          animate
        );

        return;
      }

      /*
       * 逆方向の終端
       */
      if (
        direction === -1 &&
        currentIndex <= 0
      ) {
        headIndex = 0;

        direction = 1;

        startTime =
          timestamp;

        /*
         * 一周したので
         * セルを復活
         */
        resetCells();

        requestAnimationFrame(
          animate
        );

        return;
      }

      /*
       * 次のフレーム
       */
      requestAnimationFrame(
        animate
      );
    }

    /*
     * 初期位置
     */
    updateSnake(0);

    /*
     * 開始
     */
    requestAnimationFrame(
      animate
    );

    ]]>
  </script>

</svg>
`.trim();
}

export default async function handler(req, res) {
  const { user } = req.query;

  if (
    !user ||
    typeof user !== "string"
  ) {
    return res
      .status(400)
      .send("Missing user");
  }

  try {
    const calendar =
      await getContributions(user);

    const grid =
      createGrid(calendar);

    const snakePath =
      createSnakePath(grid);

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
