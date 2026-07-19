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

/**
 * 蛇の移動経路を作る
 *
 * 左から右へ進みながら、
 * 1列ごとに上下方向を反転させる。
 *
 * つまり:
 *
 * ↓ ↑ ↓ ↑ ↓
 * ↓ ↑ ↓ ↑ ↓
 * ↓ ↑ ↓ ↑ ↓
 *
 * ではなく、実際には
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
 * のような連続した経路になる。
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
  /*
   * GitHubのContribution Gridに近いサイズ
   */
  const cellSize = 10;
  const gap = 3;
  const step = cellSize + gap;

  const columns = grid.length;
  const rows = 7;

  const width = columns * step;
  const height = rows * step;

  /*
   * 1マスを描画
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
   * 蛇が通るルート
   *
   * 本家っぽく、
   * 1セルごとに「食べる」アニメーションをする。
   */
  const animations = snakePath
    .map((cell, index) => {
      const selector =
        `.cell-${cell.x}-${cell.y}`;

      const delay =
        index * 0.035;

      return `
        ${selector} {
          animation:
            eat-cell
            0.18s
            ease-out
            ${delay}s
            forwards;
        }
      `;
    })
    .join("");

  /*
   * 蛇の座標
   */
  const snakePoints = snakePath
    .map(cell => {
      const x =
        cell.x * step +
        cellSize / 2;

      const y =
        cell.y * step +
        cellSize / 2;

      return {
        x,
        y
      };
    });

  /*
   * 蛇の移動用Path
   */
  const snakeD = snakePoints
    .map((point, index) => {
      return `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`;
    })
    .join(" ");

  /*
   * 速度
   */
  const duration =
    Math.max(
      8,
      snakePath.length * 0.035
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
      transform-box: fill-box;
      transform-origin: center;
    }

    /*
     * 蛇が食べたセルを消す
     */
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

    /*
     * 蛇本体
     */
    .snake {
      fill: none;
      stroke: #ffffff;
      stroke-width: 7;
      stroke-linecap: round;
      stroke-linejoin: round;

      stroke-dasharray: 35 100000;
      stroke-dashoffset: 35;

      animation:
        snake-move
        ${duration}s
        linear
        infinite;
    }

    /*
     * 蛇の頭
     */
    .snake-head {
      fill: #ffffff;

      animation:
        snake-head-move
        ${duration}s
        linear
        infinite;
    }

    @keyframes snake-move {
      0% {
        stroke-dashoffset: 35;
      }

      100% {
        stroke-dashoffset: -${snakePath.length * 15};
      }
    }

    /*
     * 蛇の頭を動かすためのアニメーション
     *
     * motion-pathを使うため、
     * 最新ブラウザでは自然な動きになる。
     */
    @keyframes snake-head-move {
      0% {
        offset-distance: 0%;
      }

      100% {
        offset-distance: 100%;
      }
    }
  </style>

  <!-- Contribution Grid -->
  ${cells}

  <!-- 蛇の移動パス -->
  <path
    id="snake-path"
    d="${escapeXml(snakeD)}"
    fill="none"
    stroke="none"
  />

  <!-- 蛇本体 -->
  <path
    class="snake"
    d="${escapeXml(snakeD)}"
  />

  <!-- 蛇の頭 -->
  <circle
    class="snake-head"
    r="5"
    style="
      offset-path: path('${escapeXml(snakeD)}');
      offset-rotate: auto;
    "
  />

</svg>
`.trim();
}

export default async function handler(req, res) {
  const { user } = req.query;

  if (!user || typeof user !== "string") {
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
