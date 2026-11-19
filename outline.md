# TFTVN v2 -- Outline xây dựng lại bằng Next.js trên Vercel

> Mục tiêu: viết lại TFTVN (đồ án tốt nghiệp, Set 17) bằng **TypeScript toàn bộ** trong **một project Next.js** (frontend + backend Node) deploy lên **Vercel**. Tối ưu toàn bộ tính năng và **dùng được cho mọi TFT Set** mà không phải sửa code khi Set mới ra.
>
> Phạm vi: **không có tính năng AI** (bỏ chatbot RAG, Feature 7 của bản đồ án). Còn lại 8 tính năng: Thư viện (1), Tra cứu người chơi (2), Bảng xếp hạng (3), Thống kê (4), Bài viết (5), Đội hình (6), Tài khoản (8), Admin (9).

---

## 0. Nguyên tắc thiết kế

1. **Set-agnostic**: mọi dữ liệu game có khóa theo Set và patch. Không hardcode `TFTSet17` ở bất kỳ đâu.
2. **ETL ngoài request**: CommunityDragon và thống kê Riot chạy bằng GitHub Actions cron, ghi vào Postgres. Request chỉ đọc.
3. **Cache bằng ISR**: trang thư viện và thống kê được render sẵn và cache theo tag; ETL gọi webhook để làm mới khi có dữ liệu mới.
4. **Stateless**: cache API và rate limit nằm trong Postgres, không dùng RAM của process (Vercel là serverless).
5. **Một project, một ngôn ngữ, một domain**: TypeScript cho FE, BE và ETL; type và schema `zod` dùng chung; cùng domain nên cookie httpOnly chạy được và không cần CORS.
6. **Portable**: API viết bằng Hono, nên tách ra server riêng sau này vẫn dễ.

### Quy tắc code

1. **Không viết comment**, chỉ có code. Ý nghĩa thể hiện qua tên biến, hàm, kiểu; giải thích thiết kế để trong outline / README.
2. **Màu chỉ dùng tên màu CSS chuẩn** ([danh sách W3Schools](https://www.w3schools.com/cssref/css_colors.php), ví dụ `black`, `gold`, `white`). Không dùng hex, `rgb()`, `hsl()`. Cần độ trong suốt thì dùng opacity modifier của Tailwind (`bg-white/5`, `border-gold/30`); Tailwind v4 tự sinh `color-mix()` từ tên màu.
3. **Theme**: đen là màu chủ đạo, vàng là màu phụ, chữ trắng (bảng màu ở mục 6.2).
4. **Song ngữ Việt - Anh, tiếng Việt là chính**: không viết cứng chữ giao diện trong component (chi tiết ở mục 6.1).
5. **Gọi HTTP bằng axios**: client gọi `/api/*` qua instance `api` (`src/lib/api-client.ts`); server / ETL gọi Riot API và CommunityDragon cũng bằng axios. Server Component đọc DB trực tiếp, không gọi HTTP.
6. **Package luôn cài bản mới nhất** (`pnpm add <pkg>@latest`).
7. **Tự kiểm tra bằng tool**: ESLint có hai rule nội bộ `tftvn/no-comments` và `tftvn/css-named-colors` (file `eslint.shared.mjs`); Unit test (Playwright) kiểm tra mọi giá trị trong `colors.js` là tên màu CSS và hai file ngôn ngữ có cùng bộ key. Tailwind tắt bảng màu mặc định (`--color-*: initial`), chỉ còn token trong `colors.js`.

---

## 1. Kiến trúc tổng quan

```
  GitHub Actions (cron)
  `- etl: sync-gamedata, sync-matches, cleanup --> Neon Postgres
                                              `--> POST /api/revalidate (làm mới cache)

  Trình duyệt --> Vercel (một project Next.js)
                  |- Trang (Server Components): đọc thẳng DB, cache ISR theo tag
                  `- /api/* (Hono): auth, bài viết, đội hình, bookmark, meta, player, leaderboard
                       `--> Neon Postgres, Riot API, Gmail SMTP
```

| Thành phần           | Bản đồ án                            | Bản mới                                                              |
| -------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| Frontend             | React + Vite (SPA)                   | **Next.js App Router** (Server Components + ISR, Turbopack)          |
| Styling              | Inline style + `colors.js`           | **Tailwind CSS v4**, màu vẫn lấy từ `colors.js`                      |
| Backend              | Spring Boot                          | **Hono (Node)** mount trong Next.js tại `/api/*`                     |
| DB                   | PostgreSQL tự host                   | Neon Postgres (Vercel Marketplace)                                   |
| ORM                  | Hibernate                            | Drizzle ORM + `@neondatabase/serverless`                             |
| Thư viện game        | CDragon fetch lúc request + Caffeine | Đọc DB trong Server Component, **ISR** theo tag `gamedata`           |
| Thống kê             | Gọi Riot lúc request (khoảng 20 s)   | Cron thu match dần, gom bằng SQL, **ISR** theo tag `stats`           |
| Cache API            | Caffeine (RAM)                       | Bảng `riot_cache` trong Postgres (bảng thường, job cleanup dọn)      |
| Lưu file gốc CDragon | Không có                             | GitHub Release asset theo từng patch                                 |
| Chatbot AI           | FastAPI + ChromaDB + Groq            | **Bỏ**                                                               |
| Email                | Gmail SMTP                           | Gmail SMTP qua `nodemailer` (dev: in link ra terminal)               |
| Auth                 | JWT 7 ngày trong localStorage        | Access token ngắn hạn + refresh token xoay vòng, **cookie httpOnly** |
| XSS                  | DOMPurify phía client                | `sanitize-html` khi lưu + DOMPurify khi render + CSP header          |
| Schema               | `ddl-auto=update`                    | SQL migration có version + `drizzle-kit pull` sinh type              |
| Test                 | Thủ công                             | **Playwright** (unit + e2e)                                          |

---

## 2. Cấu trúc monorepo (pnpm workspaces)

```
tftvn/
|- apps/
|  `- web/                       # Next.js (App Router, TypeScript, Tailwind v4)
|     |- app/                    # các trang
|     |- app/api/[[...route]]/   # route.ts mount Hono app
|     `- server/                 # Hono routes, middleware, service
|- packages/
|  |- core/                      # type, zod schema, parser CDragon, HashResolver, mã team planner, logic thống kê
|  |- db/                        # Drizzle schema (sinh từ DB), client, migration runner
|  `- etl/                       # CLI: sync-gamedata, sync-matches, cleanup
|- migrations/                   # 0001_init.sql, 0002_...sql
|- .github/workflows/            # ci.yml, etl.yml
|- pnpm-workspace.yaml
`- package.json
```

**Package gợi ý**

- **web (giao diện)**: `next`, `react`, `tailwindcss`, `@tailwindcss/postcss`, `clsx`, `tailwind-merge`, `axios`, `@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/pm` (editor bài viết), `next-intl`. Không dùng thư viện icon riêng: mọi icon game (tướng, trang bị, tộc hệ, chỉ số, vai trò) lấy từ CDN CommunityDragon.
- **web (server)**: `hono`, `zod`, `jose` (JWT), `@node-rs/argon2`, `sanitize-html`, `nodemailer`, `axios`, `drizzle-orm`, `@neondatabase/serverless`.
- **etl**: `axios`, `bottleneck` (rate limiter Riot).
- **dev**: `typescript`, `@playwright/test`, `drizzle-kit`, `eslint`, `eslint-config-next`, `typescript-eslint`, `prettier`, `prettier-plugin-tailwindcss`.

**Phiên bản đang dùng (P0, cài bằng `@latest`)**: Next 16.4.6, React 19.3.1, next-intl 4.15.1, Hono 4.13.19, axios 1.21.1, Tailwind 4.3.5, Playwright 1.65.1, ESLint 10.15.0, Prettier 3.10.1, drizzle-orm 0.45.4, drizzle-kit 0.31.11, tsx 4.23.15, TypeScript 6.0.3.

**Chỉ dùng một bản TypeScript (6.0.3), khai báo một lần ở `package.json` root**. Các package con tìm thấy nó vì Node tìm module ngược lên thư mục cha. Không dùng TS 7 (bản mới nhất) vì TS 7.0 chưa có API lập trình: typescript-eslint và bước type-check của `next build` không chạy được với nó. Đây là ngoại lệ duy nhất của quy tắc "luôn cài bản mới nhất"; chuyển lên TS 7 khi typescript-eslint hỗ trợ (dự kiến TS 7.1).

**Next 16**: file middleware đổi tên thành `src/proxy.ts`; type `LayoutProps` / `PageProps` do `next typegen` sinh ra (script `typecheck` đã chạy sẵn).

---

## 3. Thiết kế dữ liệu (PostgreSQL trên Neon)

> Bản nháp DDL đầy đủ: `migrations/0001_init.sql`.

### 3.0 Quy ước chung

**Đặt tên**

| Quy tắc                                                                                                    | Ví dụ                                         |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `snake_case`, chữ thường, tiếng Anh (tiếng Việt chỉ nằm trong dữ liệu)                                     | `created_at`                                  |
| Tên bảng là danh từ số nhiều                                                                               | `users`, `comps`                              |
| Khóa chính là `id` (ngoại lệ: bảng nối / khóa tự nhiên dùng khóa ghép)                                     | `articles.id`                                 |
| Khóa ngoại `<số ít>_id`, hoặc theo vai trò                                                                 | `comp_id`, `author_id`, `reviewed_by`         |
| Không lặp tên bảng trong tên cột, không viết tắt                                                           | `comps.name`, `champion` (không dùng `champ`) |
| Boolean `is_`; thời gian `_at` kiểu `timestamptz`; mảng dùng số nhiều                                      | `is_current`, `used_at`, `tags`               |
| ID game luôn là `api_name`: tham chiếu đơn `<entity>_api_name`, mảng dùng số nhiều                         | `champion_api_name`, `items`                  |
| `tier` chỉ dùng cho meta tier; sao = `star_level`; Challenger/GM/Master = `rank_tier`; mốc trait = `level` |                                               |
| Index `<bảng>_<cột>_idx`, unique `_key`, check `_check`                                                    | `articles_status_created_at_idx`              |
| TypeScript: Drizzle `casing: "snake_case"` tự đổi sang camelCase                                           | `createdAt`, `starLevel`                      |

**Khác**

- Khóa nội bộ: `bigint GENERATED ALWAYS AS IDENTITY`. Comp và bài viết có thêm `public_id uuid` (UUIDv7) để dùng trên URL, tránh lộ ID tăng dần.
- ENUM: `user_role`, `user_token_kind`, `article_status`, `reaction_kind`, `meta_tier`, `game_entity_kind`, `rank_tier`, `etl_status`.
- `username`, `email` dùng `citext` (không phân biệt hoa thường).
- Token chỉ lưu hash SHA-256, không lưu token gốc.
- Xóa mềm (`deleted_at`) cho `articles` và `comps`.
- **Migration**: viết SQL tay trong `migrations/`, chạy bằng runner nhỏ trong `packages/db` (ghi lại vào bảng `schema_migrations`), sau đó `drizzle-kit pull` để sinh schema TypeScript.

**Tổng cộng 21 bảng**

| Nhóm             | Bảng                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| Dữ liệu game (4) | `game_sets`, `gamedata_snapshots`, `patches`, `game_entities`                                          |
| Tài khoản (2)    | `users`, `user_tokens`                                                                                 |
| Nội dung (7)     | `comps`, `bookmarks`, `role_items`, `champion_roles`, `articles`, `article_reactions`, `article_comps` |
| Thống kê (4)     | `matches`, `match_participants`, `entity_stats`, `stat_totals`                                         |
| Hệ thống (4)     | `site_settings`, `etl_runs`, `riot_cache`, `rate_limits`                                               |

### 3.1 Dữ liệu game (ETL ghi)

- `game_sets(id, name, mutator, is_current, started_at)`: `id` là số Set (17, 18...).
- `gamedata_snapshots(id, set_id, source_hash, archive_url)`: mỗi lần file CommunityDragon thay đổi thì tạo một snapshot; file gốc nén lại và đính vào **GitHub Release** để chạy lại ETL khi sửa HashResolver.
- `patches(set_id, id, snapshot_id, released_at, is_current)`: khóa chính `(set_id, id)` (migration `0002`), vì cùng một bản client (`16.23`) chứa dữ liệu của cả Set hiện tại lẫn Set cũ. `id` là phiên bản client; `comps (set_id, meta_patch_id)` tham chiếu khóa ghép này.
- `game_entities(snapshot_id, kind, api_name, i18n, data, cost, traits, role_api_name, planner_code)`: **một bảng cho champion / trait / item / augment / role**, tất cả lấy từ CommunityDragon. Các cột `cost`, `traits`, `role_api_name`, `planner_code` chỉ có ở champion (có CHECK đảm bảo).
- Danh sách hash nhập tay cho HashResolver **không nằm trong DB**: để ở file `packages/core/hash-overrides.json` (có lịch sử trong git, chỉ ETL đọc).

### 3.2 Người dùng và nội dung (API ghi)

- `users(username, email, email_verified_at, password_hash, role, riot_platform, riot_game_name, riot_tag_line, riot_puuid)`
- `user_tokens(user_id, kind, token_hash, expires_at, used_at)`: một bảng cho refresh token, reset password và xác thực email (`kind`).
- `comps(public_id, owner_id, set_id, name, ..., board, champions, augments, meta_tier, meta_patch_id, meta_updated_at, deleted_at)`:
  - `board` JSONB: `[{slot, champion_api_name, star_level, hex, items}]`, tối đa 10 slot.
  - **Meta comp gộp vào đây**: `meta_tier` để trống nghĩa là comp thường. CHECK chặn xóa (kể cả xóa mềm) comp đang là meta.
- `bookmarks(user_id, comp_id)` với PK `(user_id, comp_id)`.
- `role_items(set_id, role_api_name, items, updated_by)`: trang bị gợi ý cho từng role **do admin chỉnh**. Định nghĩa role nằm trong `game_entities`; bảng này tách riêng để ETL không ghi đè, và gắn theo Set nên giữ nguyên qua các patch.
- `champion_roles(set_id, champion_api_name, role_api_name, updated_by)` (migration `0003`): role **admin gán** cho từng tướng. Role thực tế = role admin gán, nếu chưa gán thì lấy `game_entities.role_api_name` từ CommunityDragon (hàm `effectiveRole` trong `packages/core`). ETL luôn tạo đủ 12 role chuẩn (`STANDARD_ROLE_API_NAMES`) cho mọi Set để admin có danh sách chọn; tên hiển thị của role nằm trong `messages/vi.json` / `en.json`.
- `articles(public_id, author_id, set_id, title, category, tags, body, status, reviewed_by, reviewed_at, review_note, deleted_at)`: biết admin nào duyệt/từ chối và lý do.
- `article_reactions(article_id, user_id, kind)` với PK `(article_id, user_id)`: mỗi user một reaction, đổi bằng `ON CONFLICT DO UPDATE`.
- `article_comps(article_id, comp_id)`: bài viết gắn được nhiều comp.

### 3.3 Thống kê (ETL ghi)

- `matches(id, set_id, patch_id, queue_id, source_rank_tier, played_at)`: không lưu raw JSON. `source_rank_tier` là rank cao nhất trong số người chơi được theo dõi có trận này; thống kê của rank tính trên cả 8 người.
- `match_participants(match_id, puuid, placement, player_level, units JSONB, traits JSONB)`: chi tiết để tính lại khi cần.
- `entity_stats(set_id, patch_id, rank_tier, kind, api_name, variant, games, placement_sum, top1_count, top4_count)`: **cộng dồn** trong cùng transaction khi insert match mới, chạy lại không đếm trùng. `variant`:
  - `''`: tổng của entity.
  - Trait: mốc kích hoạt (`level`).
  - Item: `champion_api_name`, tức tướng cầm trang bị đó.
- `stat_totals(set_id, patch_id, rank_tier, match_count, participant_count)`: để tính pick rate sau khi chi tiết match cũ bị xóa.
- Thời hạn lưu: chỉ giữ chi tiết match của Set hiện tại và vài patch gần nhất.

### 3.4 Hệ thống, cache và rate limit

- `site_settings(key, value JSONB)`: nhãn patch, ghi đè Set hiện tại...
- `etl_runs(job, status, started_at, finished_at, summary, error)`: lịch sử chạy ETL; trang thống kê hiển thị "Dữ liệu cập nhật lúc ..." từ đây.
- `riot_cache(key, value, expires_at)`, `rate_limits(bucket, window_start, hits)`: ban đầu là bảng UNLOGGED, nhưng Neon tự tạm dừng compute khi rảnh và mỗi lần như vậy xóa sạch bảng UNLOGGED (cache match 7 ngày mất liên tục, rate limit bị reset). Migration `0004` chuyển về bảng thường; dòng hết hạn do job `cleanup` xóa.
- Code đặt sau interface `Cache` / `RateLimiter` để sau này đổi sang Redis không phải sửa chỗ khác.

### 3.5 Kết nối từ serverless

- Server dùng driver `@neondatabase/serverless` (hoặc URL pooled). Migration và ETL dùng URL direct.
- Neon free tier tự tắt compute khi không có ai dùng, nên query đầu sau đó chậm hơn.

---

## 4. Pipeline dữ liệu (`packages/etl`, chạy bằng GitHub Actions)

### 4.1 `sync-gamedata` (hằng ngày hoặc khi có patch mới)

**Đã làm (P1)**. Lệnh: `pnpm etl sync-gamedata [--set N] [--dry-run] [--verbose]`.

1. Tải bằng axios: `content-metadata.json`, `cdragon/tft/vi_vn.json`, `cdragon/tft/en_us.json` (mỗi file khoảng 24 MB) và `tftchampions-teamplanner.json`.
2. **Patch**: `patches.id` là phiên bản client lấy từ `content-metadata.json` (ví dụ `16.23`), khớp với `game_version` trong match của Riot. Nhãn hiển thị kiểu "18.7" do admin đặt ở `site_settings.patch_label`.
3. **Tự phát hiện Set**: trong `setData` có nhiều biến thể (PAIRS, TURBO, PVEMODE, CarouselOfChaos...). Chỉ xét mutator đúng dạng `TFTSet<N>` và chọn N lớn nhất. Không dựa vào tiền tố champion: Set 18 dùng `DA_...` và `name` là `"Set10"`. Admin ghi đè qua `site_settings.current_set_override`; P4 sẽ đối chiếu thêm với `tft_set_number` trong match Riot.
4. **Champion chơi được** lấy theo danh sách teamplanner của mutator đó (Set 18: 65, Set 17: 64). `team_planner_code` thập phân đổi sang 3 chữ số hex (`1026` -> `402`). `champion.traits` trong file là **tên đã dịch**, parser đổi sang `apiName` của trait.
5. **HashResolver v2** (`packages/core`):
   - FNV-1a 32-bit trên tên viết thường (đã kiểm tra khớp với danh sách hash của CommunityDragon).
   - Từ vựng lấy từ **toàn bộ file** của cả hai ngôn ngữ: mọi placeholder, key chưa bị hash, tên biến kỹ năng. Cộng thêm `packages/core/src/hash-overrides.json`.
   - Danh sách hash bin-field công khai của CommunityDragon **không giải được key nào** (0/83 ở Set 17): nó chứa tên field bin, không chứa tên biến TFT.
   - Còn khoảng 195 key bị hash ở Set 18, nhưng **mô tả không dùng tới** nên không ảnh hưởng hiển thị.
6. **Điền placeholder** (`@Name@`, `@Name*100@`), không phân biệt hoa thường, tra theo tên hoặc theo hash của chính tên placeholder:
   - Trait: thẻ `<row>` thứ k dùng mốc kích hoạt thứ k; `<expandRow>` được nhân bản cho từng mốc; phần còn lại dùng mốc đầu.
   - Giá trị chỉ có lúc chạy game (`@TFTUnitProperty...@`) và giá trị thiếu hiển thị `?`.
   - Biến kỹ năng champion theo sao hiển thị `1 sao/2 sao/3 sao`.

   | Set 18                | Điền đủ | Còn `?`                                                                                                        |
   | --------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
   | Augment (594)         | 588     | 6 (giá trị `null` ngay trong dữ liệu nguồn)                                                                    |
   | Trait (36)            | 36      | 0                                                                                                              |
   | Item (776)            | 775     | 1                                                                                                              |
   | Kỹ năng champion (65) | 0       | 65 (mô tả dùng giá trị tính toán như `MagicDamageCalc1`, công thức nằm trong file bin riêng của từng champion) |

7. **Ghi DB** trong một transaction: upsert `game_sets`; snapshot tính theo hash nội dung đã parse của **riêng Set đó** (chạy lại không tạo trùng); upsert `patches (set_id, id)`; Set hiện tại được đánh dấu `is_current`. Mỗi lần chạy ghi vào `etl_runs`.
8. Khi có snapshot mới và đang chạy trong GitHub Actions: nén file gốc, đính vào GitHub Release `gamedata-<patch>`, rồi gọi `REVALIDATE_URL` (route này làm ở P2).

**Việc còn mở sau P1**

- Kỹ năng champion: đọc `mSpellCalculations` trong file bin của từng champion để tính `...Calc` (chưa làm, hiện hiển thị bảng biến theo sao).
- Role: Set 17 có 12 role (63/64 champion); **Set 18 gần như không có** (63/65 champion `role: null`), và file không có tên hiển thị của role. Đã chốt: admin tự gán role qua bảng `champion_roles` (màn hình admin làm ở P5).

### 4.2 `sync-matches` (vài giờ một lần)

- Lấy Challenger / Grandmaster / Master (máy chủ `vn2`), mỗi bậc top `--players` người theo LP (mặc định 10), mỗi người `--matches` trận gần nhất (mặc định 10). Một trận thuộc bậc đầu tiên thấy nó. Chỉ tải match chưa có trong `matches`.
- Client Riot riêng (`packages/riot`, axios): bộ giới hạn tự viết theo hai cửa sổ 20 req/1 giây và 100 req/2 phút (đúng dev key); gặp 429 thì chờ `Retry-After`, 5xx thì thử lại tối đa 3 lần. Không cần `bottleneck`.
- Lọc queue ranked `1100` và `tft_set_number` của Set hiện tại. `game_version` bị Riot che ("TFT Unreal Version ?.?.?.?") nên patch của trận suy ra từ `patches.released_at` so với thời điểm chơi (`patchForMatch`). Insert + cộng dồn `entity_stats` và `stat_totals` trong một transaction; chạy lại không đếm trùng (đã kiểm: lần 2 lưu 0 trận).
- Xong thì gọi `POST /api/revalidate` với tag `stats`.
- **Bắt buộc**: xin Riot Personal hoặc Production API key (dev key hết hạn sau 24 giờ).

### 4.3 `cleanup` (hằng ngày)

- **Đã làm (P6)**: `pnpm etl cleanup`, chạy hằng ngày sau `sync-gamedata` trong `etl.yml` (vẫn chạy khi bước trước lỗi). Xóa `riot_cache` hết hạn, `rate_limits` cũ hơn 1 ngày, token hết hạn quá 1 ngày hoặc đã dùng quá 7 ngày, match của Set cũ (thống kê đã cộng dồn nên không mất số liệu), `etl_runs` cũ hơn 90 ngày. Kết quả ghi vào `etl_runs` (job `cleanup`).

### 4.4 Nơi chạy ETL

- **GitHub Actions cron**: `etl.yml` (sync-gamedata, 03:17 hằng ngày) và `matches.yml` (sync-matches, 6 giờ một lần, phút 41). Job lâu, gọi Riot nhiều, nên tránh giới hạn thời gian của Vercel Function. Có `workflow_dispatch` để admin chạy tay.
- Vercel Cron chỉ dùng cho việc nhẹ (health check) nếu cần.

---

## 5. Backend (Hono trong Next.js)

- Mount một Hono app tại `app/api/[[...route]]/route.ts` (adapter `hono/vercel`), code route nằm trong `apps/web/server/`.
- Route: `auth`, `users`, `articles`, `comps`, `bookmarks`, `meta`, `player`, `leaderboard`, `settings`, `revalidate`.
- **Thư viện và thống kê không cần route riêng**: Server Component đọc thẳng DB qua các hàm service dùng chung. Có thể thêm route JSON public sau nếu cần.
- `revalidate`: chỉ nhận request có `REVALIDATE_SECRET`, gọi `revalidateTag(tag)`.
- Player lookup / leaderboard: gọi Riot khi có request, cache `riot_cache` khoảng 5 phút, có stale-while-revalidate.
- Validate input bằng `zod` (schema dùng chung với FE qua `packages/core`).
- Lỗi thống nhất: middleware ánh xạ lỗi ra HTTP 400/401/403/404/429.
- Phân quyền: middleware `requireUser`, `requireAdmin`.

---

## 6. Frontend (Next.js App Router)

### 6.1 Routing và render

- **Một bộ đường dẫn duy nhất (tiếng Anh)**, tiếng Việt và tiếng Anh chỉ khác tiền tố `/en`:
  - `/library` (chọn Set), `/library/18` (tổng quan), `/library/18/champions`, `/library/18/champions/DA_Gromp18_AP`, `/library/18/traits`, `/library/18/items`, `/library/18/augments`, `/library/18/roles`.
  - Bản tiếng Anh: `/en/library/18/champions`... Hàm tạo đường dẫn nằm ở `src/lib/library-paths.ts`.
- **Cache Components** (`cacheComponents: true`, `partialPrefetching: true` trong `next.config.ts`):
  - Hàm đọc dữ liệu trong `src/server/library.ts` dùng `"use cache"` + `cacheLife("max")` + `cacheTag`.
  - Tag `gamedata`: Set nào trỏ tới snapshot nào (ETL làm mới sau mỗi snapshot mới). Tag `snapshot:<id>`: entity của snapshot (không bao giờ đổi). Tag `roles:<set>`: role / trang bị admin gán (P5 làm mới khi admin sửa).
  - `POST /api/revalidate` (Hono): cần `Authorization: Bearer $REVALIDATE_SECRET`, chỉ nhận tag trong danh sách cho phép, gọi `revalidateTag(tag, "max")`.
- **Tạo trang sẵn lúc build**: `generateStaticParams` lấy Set và tướng từ DB (build có DB tạo khoảng 315 trang tĩnh). Không có DB (CI) thì trả về param giữ chỗ `__placeholder__` và trang gọi `notFound()` trước khi chạm DB, nên build vẫn qua; trang render ở request đầu rồi được cache.
- Phần đọc `params` của Thư viện nằm trong `<Suspense>` (yêu cầu của Cache Components). Set không tồn tại hiện trang "không tìm thấy" kèm `noindex` (mã 200 vì trang được stream).
- Mô tả game hiển thị qua `parseGameText` (core) + `GameText` (React), **không dùng `dangerouslySetInnerHTML`**.
- Trang Trang bị hiện các nhóm chính, nhóm "khác" (khoảng 440 item cơ chế / Set cũ) thu gọn và chỉ có icon + tên.
- **Thống kê**: Server Component đọc `entity_stats` + `stat_totals`, cache theo tag `stats`; hiển thị thời điểm cập nhật từ `etl_runs`.
- **Player / leaderboard**: Server Component gọi service (đã có `riot_cache`), cache ngắn.
- **Phần tương tác** (builder, editor, reaction, bookmark): Client Component gọi `/api/*` bằng axios (instance `api`), giữ trạng thái bằng `useState`; sau khi ghi thì `router.refresh()`. Không cần TanStack Query.
- **Đọc người xem ở server** (`getViewer` trong `server/auth/viewer.ts`): JWT chỉ xác định là ai, còn `role` và `username` luôn đọc lại từ DB, nên hạ quyền admin có hiệu lực ngay. Access token sống 15 phút nên có lúc server thấy "chưa đăng nhập" trong khi client đã làm mới token; `<ViewerSync>` so user ở client với server và gọi `router.refresh()` một lần khi lệch.
- **Ghi dữ liệu người dùng** (comp, bài viết, role) gọi `revalidateTag(tag, { expire: 0 })` trong route Hono (`updateTag` chỉ dùng được trong Server Action), nên người dùng thấy thay đổi ngay ở lần tải sau.
- **Partial Prefetching**: App Shell dùng chung cho mọi link tới cùng route, nên trang **không đọc `params` / `searchParams` ở ngoài `<Suspense>`**; trang chỉ dựng phần khung, phần đọc params nằm trong component con bọc Suspense. Việc chạm DB theo request (rate limit, `getViewer`) gọi `await connection()` trước, để prerender ngầm lúc runtime không chạy truy vấn rồi bỏ dở. Trang chỉ để chuyển hướng (`/stats`) đặt `export const instant = false`.
- **Phiên đăng nhập ở client**: `AuthProvider` gọi `GET /api/auth/session`; khách nhận `{ user: null }` (200, không ghi lỗi 401 ra console), còn phiên hết access token mà còn refresh token thì được làm mới ngay trong request đó.
- **Song ngữ Việt - Anh (Việt là chính)** bằng `next-intl`:
  - Locale `vi` (mặc định) và `en`. Tiếng Việt không có tiền tố URL, tiếng Anh có `/en` (`localePrefix: "as-needed"`). **Không đoán ngôn ngữ theo trình duyệt** (`localeDetection: false`): URL quyết định ngôn ngữ, `/` luôn là tiếng Việt kể cả khi trình duyệt dùng tiếng Anh (e2e có kiểm tra).
  - Locale đọc bằng `next/root-params` (Next 16.3+) trong `src/i18n/request.ts`; trang lấy locale bằng `currentLocale()` (`getLocale`). Không dùng `setRequestLocale` (đã deprecate trong next-intl 4.15).
  - Mọi chữ giao diện nằm trong `messages/vi.json` và `messages/en.json`; thiếu bản dịch `en` thì hiện bản `vi`. Test kiểm tra hai file có cùng bộ key.
  - Tên và mô tả tướng / tộc hệ / trang bị / lõi / role lấy từ trường `i18n` của dữ liệu game (CommunityDragon `vi_vn` và `en_us`).
  - Bài viết do người dùng viết giữ nguyên ngôn ngữ tác giả, không dịch tự động.
  - Nút chuyển ngôn ngữ trên header; email reset mật khẩu gửi theo ngôn ngữ người dùng đang dùng.
- Ảnh tướng/trang bị: dùng thẳng URL của CommunityDragon (khai báo `images.remotePatterns`, hoặc `unoptimized` để không tốn quota tối ưu ảnh của Vercel).

### 6.2 Styling bằng Tailwind v4

- Cài đặt:

  ```bash
  pnpm add tailwindcss @tailwindcss/postcss
  ```

  ```js
  // postcss.config.mjs
  export default { plugins: { "@tailwindcss/postcss": {} } };
  ```

  ```css
  /* app/globals.css */
  @import "tailwindcss";
  @config "../tailwind.config.mjs";
  ```

- **`colors.js` là nơi duy nhất định nghĩa màu**, giá trị **chỉ là tên màu CSS chuẩn**. `tailwind.config.mjs` import object `C` từ `colors.js` vào `theme.extend.colors`. Trong JSX chỉ dùng class (`bg-bg`, `text-primary`, `bg-surface/5`...), không viết màu rải rác.
- **Bảng màu (đen chủ đạo, vàng phụ, chữ trắng)**:

  | Token              | Màu CSS                                                       | Dùng cho                                  |
  | ------------------ | ------------------------------------------------------------- | ----------------------------------------- |
  | `bg`               | `black`                                                       | Nền trang                                 |
  | `surface`          | `white` (dùng kèm opacity: `bg-surface/5`, `bg-surface/10`)   | Card, panel, ô nhập trên nền đen          |
  | `line`             | `white` (dùng kèm opacity: `border-line/10`)                  | Viền, đường kẻ                            |
  | `primary`          | `gold`                                                        | Nút chính, link, tab đang chọn, highlight |
  | `primaryHover`     | `goldenrod`                                                   | Hover / active của màu vàng               |
  | `onPrimary`        | `black`                                                       | Chữ trên nền vàng                         |
  | `text`             | `white`                                                       | Chữ chính                                 |
  | `muted`            | `darkgray`                                                    | Chữ phụ, placeholder                      |
  | `danger`           | `crimson`                                                     | Lỗi, xóa                                  |
  | `success`          | `limegreen`                                                   | Thành công                                |
  | `cost1` .. `cost5` | `darkgray`, `limegreen`, `dodgerblue`, `mediumorchid`, `gold` | Viền / nền theo giá tướng                 |
  | `tierS` .. `tierX` | `crimson`, `darkorange`, `gold`, `limegreen`, `deepskyblue`   | Meta tier S, A, B, C, X                   |

- `clsx` + `tailwind-merge` để gộp class có điều kiện. Responsive mobile-first (kiểm tra cả trên iPhone).

### 6.3 Tính năng chính

- Tra cứu người chơi `/players` -> `/players/[gameName]/[tagLine]`: rank mọi chế độ, 5 trận gần nhất (tộc hệ tô màu theo mốc, tướng viền theo giá + sao + trang bị, cả sảnh 8 người trong `<details>`). Gọi Riot qua `riot_cache` (account 1 giờ, rank và match ids 5 phút, match 7 ngày), giới hạn 30 lượt/phút/IP qua `rate_limits`. Dấu `.` trong tên được mã hóa thành `%2E` và `proxy.ts` chỉ bỏ qua đuôi file tĩnh, để tên có dấu chấm vẫn qua i18n.
- Bảng xếp hạng `/leaderboard?page=N`: Thách Đấu VN sắp theo LP, 20 người/trang, tên lấy từ `account-v1` (cache 1 ngày).
- Thống kê `/stats/[tier]/[section]` (`/stats` chuyển tới `challenger/champions`): 3 bậc x 3 mục, bảng sắp xếp ở client. Tướng kèm 3 trang bị hay dùng nhất (từ dòng item có variant là tướng), trang bị kèm 3 tướng hay cầm, tộc hệ kèm mốc. Cảnh báo khi mẫu dưới 100 trận.

- **Đội hình** (P5): `/comps` (meta theo tier S/A/B/C/X), `/comps/latest` (lọc theo tướng), `/comps/mine`, `/comps/bookmarks`, `/comps/new`, `/comps/[id]`, `/comps/[id]/edit`.
  - **Builder** (Client Component): bàn cờ lục giác 4 x 7, bấm hoặc kéo thả tướng, chọn tướng rồi bấm trang bị để gắn (tối đa 3), chỉnh sao 1-3, tối đa 10 tướng, 3 lõi. Tộc hệ tính trực tiếp (`countTraits` trong core): mỗi tướng chỉ tính một lần dù có 2 bản, Ấn cộng thêm tộc nếu tướng chưa có. Ấn của Set 18 không có `associatedTraits` nên suy tộc từ apiName (`DA_18_EmblemVanguard` -> `DA_18_Vanguard`).
  - **Mã team planner**: `02` + 10 ô x 3 hex + `TFTSet<N>`, `000` là ô trống. Xuất từ bàn cờ và nhập ngược lại (từ chối mã của Set khác). Set 17 có một quái PvE mang mã `000` nên bị loại khỏi phần mã.
  - Server kiểm tra tướng, trang bị (chỉ nhóm thành phẩm, Ấn, Ánh Sáng, Tạo Tác, Hỗ trợ) và lõi có thuộc Set; chỉ chủ comp hoặc admin được sửa / xóa; admin đặt meta tier (gắn với patch hiện tại của Set); comp đang meta không xóa được (kiểm tra ở service, CHECK trong DB là lớp cuối).
- **Bài viết** (P5): `/articles` (lọc chuyên mục, thẻ), `/articles/mine`, `/articles/new`, `/articles/[id]`, `/articles/[id]/edit`. Editor TipTap (StarterKit v3: tiêu đề H2/H3, danh sách, trích dẫn, link). Bài của user chờ duyệt; user sửa bài thì quay lại hàng chờ; bài admin viết được đăng ngay. Bài chưa duyệt chỉ tác giả và admin xem được (người khác nhận 404). Gắn tối đa 5 comp bằng cách dán link. Mỗi người một reaction (yêu thích / hay / chưa hay) trên bài đã duyệt.
- **Admin** (P5): `/admin` duyệt bài (từ chối phải ghi lý do, tác giả thấy lý do); `/admin/roles` gán vai trò cho tướng và chọn tối đa 8 trang bị gợi ý cho mỗi vai trò, theo Set. Thay đổi hiện ngay ở trang Vai trò của thư viện (tag `roles:<set>`). Link "Quản trị" chỉ hiện với admin; API kiểm tra quyền bằng role trong DB.
- **Icon từ CommunityDragon**: icon chỉ số (máu, giáp, kháng phép, tốc đánh...) và icon trong mô tả (`%i:scaleAD%`) lấy từ `plugins/rcp-be-lol-game-data/global/default/assets/ux/fonts/texticons/lol/statsicon/`; icon vai trò lấy từ `.../texticons/tft/characterroles/` (AD = attack, AP = magic, H = hybrid). Icon không có trên CDN (như `set14AmpIcon`) thì hiện chữ. Dữ liệu ghi icon là `None` (icon kỹ năng ở Set 18) thì coi như không có icon.

---

## 7. Auth và bảo mật

**Đã làm (P3).** Code trong `apps/web/src/server/auth/`, giao diện trong `apps/web/src/components/auth/`.

- **Cấu trúc**: `service.ts` chứa toàn bộ logic và nhận mọi phụ thuộc qua tham số (repository, băm mật khẩu, token, mailer, tra Riot, đồng hồ). `db-repository.ts` là bản thật (Drizzle + Neon); `memory-repository.ts` là bản trong bộ nhớ cho unit test. `routes.ts` (Hono) chỉ lo cookie, CSRF, mã HTTP.
- **Cookie httpOnly**, `SameSite=Lax`, `Secure` khi `NODE_ENV=production`:
  - `tftvn_access`: JWT HS256 (`jose`), sống 15 phút, `Path=/`. Chứa `sub` (id), `username`, `role`.
  - `tftvn_refresh`: chuỗi ngẫu nhiên 32 byte, sống 30 ngày, `Path=/api`. DB chỉ lưu SHA-256 trong `user_tokens (kind = refresh)`.
  - **Xoay vòng**: mỗi lần `/api/auth/refresh` đánh dấu token cũ đã dùng và cấp token mới. Dùng lại token cũ (dấu hiệu bị lộ) thì **thu hồi toàn bộ** refresh token của user.
  - Axios client gặp 401 thì tự gọi `/api/auth/refresh` một lần rồi thử lại (`src/lib/api-client.ts`).
- **CSRF**: mọi request ghi tới `/api/auth/*` và `/api/users/*` phải có header `Origin` trùng origin của site (hoặc nằm trong `APP_ORIGINS`), nếu không trả 403 `forbiddenOrigin`. Kết hợp `SameSite=Lax` nên không cần double-submit token.
- **Mật khẩu**: argon2id (`@node-rs/argon2`). Đăng nhập sai tên hay sai mật khẩu đều trả cùng một lỗi `invalidCredentials`; user không tồn tại vẫn chạy `verify` với một hash giả để thời gian phản hồi giống nhau.
- **Quên mật khẩu**: luôn trả 200 (không lộ email nào đã đăng ký). Mã đặt lại là chuỗi ngẫu nhiên, lưu SHA-256, hiệu lực 30 phút, dùng một lần; yêu cầu mã mới thì mã cũ bị xóa; đặt lại xong thì thu hồi mọi phiên đăng nhập. Email gửi theo ngôn ngữ đang dùng, dạng multipart: bản HTML theo theme đen - vàng (`server/auth/email-template.ts`, bảng lồng và style nội tuyến cho trình đọc mail, màu lấy từ `colors.js`, mọi chuỗi đều escape) kèm bản chữ thường dự phòng; lỗi gửi mail chỉ ghi log để API vẫn trả cùng một kết quả; qua **Gmail SMTP** (`smtp.gmail.com:587`, STARTTLS, `nodemailer`) bằng app password; thiếu `SMTP_USER` / `SMTP_APP_PASSWORD` thì in link ra terminal. Không cần domain riêng; giới hạn của Gmail khoảng 500 email/ngày.
- **Profile**: đổi username / email (kiểm tra trùng, không phân biệt hoa thường nhờ `citext`); đổi mật khẩu cần mật khẩu hiện tại và đăng xuất các thiết bị khác, giữ phiên hiện tại.
- **Riot ID**: kiểm tra định dạng (tên 3-16 ký tự, tag 3-5 chữ/số). Có `RIOT_API_KEY` thì tra `account-v1` (cụm `asia`) để lấy PUUID; chưa có key thì lưu dạng "chưa xác minh".
- **Rate limit** (bảng `rate_limits`): theo IP cho đăng ký 5 lần/giờ, đăng nhập 20 lần/5 phút, quên mật khẩu 5 lần/giờ, tra cứu người chơi / bảng xếp hạng 30 lần/phút. Theo user (P6, middleware `limitPerUser` trong `server/auth/guards.ts`): tạo comp 20/giờ, sửa comp 60/giờ, viết bài 10/giờ, sửa bài 30/giờ, bookmark và reaction 120/giờ; vượt thì trả 429 `rateLimited`.
- **Validate dùng chung**: schema zod trong `packages/core/src/auth/schemas.ts` trả về **mã lỗi** (`usernameTooShort`, `emailTaken`...); giao diện dịch mã sang vi / en (`auth.errors.*`), test kiểm tra mã nào cũng có bản dịch. Ô trống được coi là chưa nhập (`dropEmptyStrings`).
- **Chưa làm**: xác thực email (`email_verify` đã có trong enum), "nhớ đăng nhập", đăng nhập bằng Google / Riot.
- **HTML bài viết**: chỉ lọc một lần bằng `sanitize-html` khi lưu (thẻ cho phép: p, br, h2, h3, strong, em, u, s, a, ul, ol, li, blockquote, code, pre, hr; link chỉ http/https/mailto, luôn thêm `rel="noopener noreferrer nofollow"` và `target="_blank"`; bỏ mọi class, style, sự kiện). Không thêm DOMPurify khi render vì phía server cần jsdom (nặng cho serverless) mà chỉ lọc lại thứ đã lọc; DB chỉ chứa HTML đã sạch.
- **Security header (P6)**, đặt trong `next.config.ts` (`headers()`), áp cho mọi đường dẫn:
  - `Content-Security-Policy`: `default-src 'self'`; script và style chỉ từ site (`'unsafe-inline'` vì Next chèn script RSC nội tuyến; dùng nonce thì mọi trang phải render động, mất Partial Prerendering); ảnh từ site, `data:`, `blob:` và `raw.communitydragon.org`; `connect-src 'self'` (dev thêm `ws:` cho HMR, `'unsafe-eval'` chỉ ở dev); `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy` tắt camera / micro / vị trí / thanh toán, `Strict-Transport-Security` (chỉ production). Bỏ header `X-Powered-By`.
- **404 thật** (P6): với Cache Components, phần khung trang gửi đi trước nên `notFound()` trong lúc render chỉ trả 200 + `noindex` (giới hạn của streaming). `proxy.ts` chặn trước những đường dẫn chắc chắn sai mà không cần DB (`lib/route-guard.ts`: bậc / mục thống kê lạ, mã comp / bài viết không phải UUID, Set không phải số, mục thư viện lạ, apiName sai ký tự) và rewrite sang route không tồn tại để nhận HTTP 404. Đường dẫn đúng dạng nhưng không có trong DB (comp đã xóa, Set 9999) vẫn 200 + `noindex`. Trang 404 có bản dịch (`app/[locale]/not-found.tsx`, catch-all `[...missing]`).
- **Cấp quyền admin** (P6): `/admin/users` tìm theo tên đăng nhập / email, đổi quyền user / admin; API `PUT /api/admin/users/:id/role` chặn admin tự đổi quyền của chính mình để không mất hết admin. Admin đầu tiên vẫn phải đặt tay trong DB.
- Secret trong Vercel Environment Variables (tách Preview và Production) và GitHub Actions secrets. Biến mới ở P3: `JWT_SECRET` (ít nhất 32 ký tự), `SMTP_USER`, `SMTP_APP_PASSWORD`, `MAIL_FROM` (mặc định `TFTVN <SMTP_USER>`; với Gmail chỉ đổi được tên hiển thị, địa chỉ luôn là `SMTP_USER`), `APP_ORIGINS`.

---

## 8. Deploy

- **Một project Vercel** cho `apps/web` (Next.js, có cả API). Không có runtime beta nào.
- Dịch vụ ngoài: Neon (Postgres, qua Vercel Marketplace), Gmail SMTP (email), Riot API key. Không cần Redis, không cần Blob.
- Preview deployment cho mỗi PR, dùng Neon branch database riêng.
- Domain: dùng `*.vercel.app` hay domain riêng đều được (không ảnh hưởng auth vì FE và API cùng domain).

### Biến môi trường dự kiến

| Nơi                           | Biến                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Vercel                        | `DATABASE_URL`, `JWT_SECRET`, `RIOT_API_KEY`, `SMTP_USER`, `SMTP_APP_PASSWORD`, `REVALIDATE_SECRET`                            |
| GitHub Actions (etl, matches) | `DATABASE_URL_DIRECT`, `RIOT_API_KEY`, `REVALIDATE_URL`, `REVALIDATE_SECRET`, `GITHUB_TOKEN` (tự có, để đính file vào Release) |
| Local `.env.local` ở gốc repo | Như `.env.example`; thiếu `SMTP_*` thì mail chỉ in ra log                                                                      |

---

### Hiệu năng đo được (P6)

Đo trên bản production chạy ở máy (`next start`, Edge, mạng nội bộ, Neon ở Singapore). "Lần đầu" là trình duyệt mới chưa có cache; "lần sau" là mở lại khi cache server đã nóng. JS là tổng script đã giải nén mà trang tải (gồm cả prefetch).

| Trang                              | TTFB lần đầu / sau | LCP lần đầu / sau | CLS   | JS                                              |
| ---------------------------------- | ------------------ | ----------------- | ----- | ----------------------------------------------- |
| `/`                                | 354 / 12 ms        | 1540 / 312 ms     | 0.038 | 452-693 KB                                      |
| `/library/18/champions`            | 54 / 20 ms         | 620 / 604 ms      | 0.045 | 157-358 KB                                      |
| `/library/18/champions/DA_18_Shen` | 52 / 14 ms         | 400 / 536 ms      | 0.045 | 317-425 KB                                      |
| `/library/18/items`                | 48 / 45 ms         | 1044 / 776 ms     | 0.045 | 148-426 KB                                      |
| `/comps`                           | 13 / 11 ms         | 2196 / 412 ms     | 0.018 | 425 KB (trước khi tắt prefetch builder: 682 KB) |
| `/articles`                        | 9 / 8 ms           | 240 / 228 ms      | 0.016 | 479 KB (trước: 629 KB)                          |
| `/stats/challenger/champions`      | 7 / 7 ms           | 964 / 256 ms      | 0.045 | 127-360 KB                                      |
| `/leaderboard`                     | 7 / 5 ms           | 188 / 176 ms      | 0.029 | 122-352 KB                                      |
| `/players/...`                     | 7 / 8 ms           | 2072 / 956 ms     | 0.020 | 98-141 KB                                       |

- Mọi trang đều đạt ngưỡng "tốt" của Core Web Vitals (LCP dưới 2,5 giây, CLS dưới 0,1). LCP lần đầu của `/comps` và trang người chơi cao hơn vì chờ ảnh từ CommunityDragon.
- Link tới builder và editor (`Tạo đội hình`, `Viết bài`, `Sửa`) đặt `prefetch={false}`: hai trang này cần đăng nhập và kéo theo TipTap / builder nặng, không đáng tải sẵn cho mọi người xem.
- Ảnh tướng ở hàng đầu tải ngay (`eager`), phần còn lại tải lười.

### Kiểm tra "Set mới ra" (P6)

- Test trong `packages/core/src/cdragon/parse.test.ts` tạo một Set 19 giả từ dữ liệu Set 17 (đổi mutator `TFTSet19`), rồi xác nhận: phát hiện Set hiện tại là 19, parse ra đúng tướng / tộc hệ / planner code như Set gốc, mã team planner xuất / nhập được với mutator mới. Không phải sửa dòng code nào.
- Phần còn lại đều đọc theo Set hiện tại trong DB: thống kê và comps (chỉ Set hiện tại), thư viện (mọi Set), mutator cho mã planner (`game_sets.mutator`).

## 9. Môi trường dev trên máy

- **Đã có**: Node 26, pnpm 12, Git, GitHub CLI. **Không cần Rust.**
- **Cần cài**: PostgreSQL (`winget install PostgreSQL.PostgreSQL.17`, tìm đúng ID bằng `winget search PostgreSQL`), hoặc dùng một Neon branch `dev`.
- Chạy:

  ```bash
  pnpm db:migrate                 # chạy migrations/*.sql
  pnpm dev                        # Next.js + API tại http://localhost:3000
  pnpm etl sync-gamedata          # nạp dữ liệu game
  pnpm etl sync-matches           # nạp thống kê (cần RIOT_API_KEY)
  pnpm test                       # unit test (Playwright)
  pnpm e2e                        # e2e (Playwright + Edge có sẵn)
  ```

- Ổ C và D đều đã dùng hơn 90%: nên dọn trước vài GB (`node_modules`, `.next`).

---

## 10. Testing và CI

**Chỉ dùng một công cụ test: Playwright** (`@playwright/test`, một bản ở root).

- **Unit test** (`pnpm test`, file `playwright.config.ts`, không cần trình duyệt; file `*.test.ts`):
  - Project `core`: HashResolver, FNV-1a, parser CommunityDragon (fixture cắt từ dữ liệu thật của **2 Set**), điền placeholder, phân loại item / augment, đọc markup, role.
  - Project `web`: màu chỉ dùng tên CSS, hai file ngôn ngữ cùng bộ key, route Hono (`createApp` nhận dependency qua tham số nên không cần mock module).
- **E2E** (`pnpm e2e`, file `playwright.e2e.config.ts`, dùng **Microsoft Edge có sẵn** trên máy qua `channel: "msedge"`, không tải trình duyệt riêng; file `apps/web/e2e/*.spec.ts`): tự build production rồi chạy server cổng 3100, cần DB có dữ liệu. Hiện kiểm tra trang chủ hai ngôn ngữ, giữ tiếng Việt với trình duyệt tiếng Anh, chọn Set, mở tướng, nhóm trang bị / lõi, đổi ngôn ngữ giữ nguyên trang, Set không tồn tại. Thêm ở P4-P5: thống kê, bảng xếp hạng, tra cứu (khi có `RIOT_API_KEY`); tạo comp bằng builder -> bookmark -> sửa -> nhập mã planner -> admin đặt meta -> chặn xóa; viết bài -> admin từ chối có lý do -> sửa -> duyệt -> reaction; admin gán vai trò tướng; user thường bị chặn khỏi admin. Next 16 giữ trang cũ ở trạng thái ẩn (`<Activity>`) sau khi chuyển trang, nên test tìm phần tử theo role hoặc lọc `visible` để không bị trùng.
- Import JSON dùng cú pháp chuẩn `with { type: "json" }` (Playwright chạy test bằng ES module của Node).
- **`ci.yml`**: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`. E2E chưa chạy trong CI vì cần DB có dữ liệu.

---

## 11. Lộ trình (khoảng 8 tuần)

| Phase  | Thời gian | Nội dung                                                                                                            | Kết quả                                  |
| ------ | --------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **P0** | 1 tuần    | Monorepo, Postgres local + Neon, migration runner, Next.js + Tailwind, Hono mount `/api`, deploy "hello" lên Vercel | Deploy chạy, trang gọi được DB và API    |
| **P1** | 2 tuần    | `packages/core`: parser đa Set, HashResolver v2, thay placeholder; ETL `sync-gamedata` + workflow `etl.yml`         | Dữ liệu Set hiện tại + 1 Set cũ trong DB |
| **P2** | 1 tuần    | Trang Thư viện (ISR, chọn Set, i18n), route revalidate                                                              | Feature 1 cho mọi Set                    |
| **P3** | 1 tuần    | Auth bằng cookie, profile, quên mật khẩu, sync tài khoản Riot                                                       | Feature 8                                |
| **P4** | 1,5 tuần  | Player lookup, leaderboard, `sync-matches`, trang thống kê                                                          | Feature 2, 3, 4                          |
| **P5** | 1,5 tuần  | Comps + builder theo Set, bookmark, articles, reactions, admin                                                      | Feature 5, 6, 9                          |
| **P6** | 1 tuần    | Hardening: rate limit, CSRF, CSP, e2e, đo hiệu năng, kiểm tra "Set mới ra"                                          | Bản production                           |

**Cột mốc "Set mới ra"**: chạy ETL với fixture của một Set khác và xác nhận không phải sửa code.

---

## 12. Quyết định cần chốt

1. Nộp đơn xin Riot Personal / Production key sớm (duyệt mất thời gian).

**Đã chốt**:

- **Role**: admin tự gán role cho từng tướng (`champion_roles`), vì CommunityDragon thiếu role ở Set 18. Màn hình gán đã có ở `/admin/roles` (P5).
- **Set cũ chỉ giữ thư viện**: thống kê, meta comps và tạo / sửa comp chỉ dùng Set hiện tại (server trả `setInvalid` cho Set cũ); trang thư viện vẫn chọn được mọi Set.
- HTML bài viết chỉ lọc bằng `sanitize-html` khi lưu (không dùng DOMPurify).
- Icon game lấy hết từ CDN CommunityDragon, không dùng thư viện icon.
- Chỉ dùng **một bản TypeScript 6** ở root.

- **Next.js + Vercel cho toàn bộ**: frontend và backend Node (Hono) trong cùng một project.
- TypeScript toàn bộ, không dùng Rust.
- Styling bằng **Tailwind CSS v4**, màu lấy từ `colors.js` và chỉ dùng tên màu CSS chuẩn; theme đen - vàng - chữ trắng.
- Song ngữ Việt - Anh (`next-intl`), tiếng Việt là chính.
- Code không có comment.
- Chỉ dùng **Playwright** cho cả unit test và e2e (không dùng Vitest).
- PostgreSQL (Neon) là database duy nhất; không dùng Redis.
- Không có tính năng AI.

---

## Tham khảo

- Next.js, caching và revalidate: <https://nextjs.org/docs/app/getting-started/caching-and-revalidating>
- Next.js, testing với Playwright: <https://nextjs.org/docs/app/guides/testing/playwright>
- Tailwind CSS, cài đặt với Next.js: <https://tailwindcss.com/docs/installation/framework-guides/nextjs>
- Hono trên Vercel / Next.js: <https://hono.dev/docs/getting-started/vercel>
- Drizzle ORM + Neon: <https://orm.drizzle.team/docs/get-started/neon-new>
- CommunityDragon: <https://raw.communitydragon.org/>
- Riot Developer Portal (TFT): <https://developer.riotgames.com/docs/tft>
