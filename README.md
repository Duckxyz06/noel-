# Noël — Christmas memories

Web app cây thông kỷ niệm dành cho một nhóm **hai người quản lý**.

**Web:** https://noel-ky-niem-duck.nguyenvietduc06xyz.chatgpt.site  
**Studio:** https://noel-ky-niem-duck.nguyenvietduc06xyz.chatgpt.site/admin

## Sử dụng

1. Chủ Studio đăng nhập ChatGPT bằng tài khoản đã tạo web. Quyền quản lý đầu tiên được nhận tự động dựa trên email xác minh phía máy chủ.
2. Trong Studio, bấm **Người quản lý thứ hai** để sao chép mã mời. Người thứ hai dùng tài khoản ChatGPT riêng, mở `/admin` và nhập mã một lần. Không có đăng ký quản trị công khai.
3. Nhập 2 tên cho người yêu (♥) hoặc bạn thân (🫶); nhập 3–8 tên cho nhóm bạn (🤝 🫶 ✨). Mỗi tên tối đa 24 ký tự.
4. Chọn tối đa 30 ảnh. JPG/PNG/WebP được nén về cạnh dài 1280 px và loại bỏ metadata ảnh khi chuyển sang JPEG. Nếu thiết bị không đọc được HEIC, chuyển ảnh sang JPG trước.
5. Lưu bản nháp hoặc bấm **Tạo QR & gửi quà**. QR chứa link ngắn `/m/<UUID>`, ảnh và nhạc được tải từ kho chung, hoạt động trên thiết bị khác.
6. Người nhận chạm ảnh để mở và phóng to, trong khi nền vẫn chuyển động. Có thể kéo/phóng vùng cây thông, bật nhạc, xem lại hiệu ứng, xem toàn màn hình.
7. **Video kỷ niệm** có bản xem trước Remotion, khung 16:9 hoặc 9:16 và xuất video 20 giây có nhạc. Giữ tab mở khi xuất. File là MP4 nếu trình duyệt hỗ trợ bộ mã hóa đó, hoặc WebM. Không cần cài đặt máy chủ render.
8. **Đóng liên kết chia sẻ** thu hồi quyền xem cả album lẫn tệp ảnh/nhạc của khách. **Xóa bộ kỷ niệm** xóa ảnh/nhạc và dữ liệu.

## Hiệu ứng

Tên bay lên thành tia sáng, hội tụ thành các vòng hình nón. Cây thông xoay chậm hơn ảnh. Ngôi sao vàng sáng dần; bóng đèn và đồ trang trí dùng bảng màu vàng, hồng đất, xanh băng và tím dịu. Nền đen, tuyết nhẹ, quầng sáng mỏng ở chân cây. Có chế độ giảm chuyển động theo thiết lập thiết bị.

Âm thanh trong tham chiếu **không được phân tích hoặc tái sử dụng** theo yêu cầu. Hai track chuông/piano đi kèm là bản phối tổng hợp mới của giai điệu Jingle Bells thuộc phạm vi công cộng. Có thể tải MP3 riêng tối đa 10 MB.

## Phát triển

Stack: React 19, Vinext/Vite, TypeScript, Canvas 2D, Remotion Player, QRCode, Cloudflare D1/R2. Đây là ứng dụng có máy chủ; GitHub Pages thuần tĩnh không cung cấp kho ảnh và quyền quản lý. Mã nguồn nằm trong repo này, bản chạy dùng Worker với D1/R2.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
```

`pnpm test` chạy Worker thật trong Miniflare với D1/R2 riêng để kiểm tra hai người quản lý, upload, bản nháp, chia sẻ, thu hồi link, range request, xóa và CSRF. Test không dùng dữ liệu hay mã mời thật.

### Cấu hình

`.openai/hosting.json` chứa định danh và binding `DB`/`BUCKET`. Runtime secrets nằm phía máy chủ, không ở trình duyệt hoặc GitHub:

- `OWNER_EMAIL`: email chủ Studio được xác minh qua SIWC.
- `INVITE_TWO_CODE`: mã ngẫu nhiên đủ dài cho người thứ hai.
- `INVITE_TWO_HASH`: SHA-256 dạng hex của mã trên.

Dùng `.env.example` làm mẫu. `.env`, `.dev.vars`, dữ liệu runtime và thông tin mời thật đều bị bỏ qua bởi Git.

Hệ thống triển khai phải xác minh rồi chuyển tiếp các header `oai-authenticated-user-*`, đồng thời loại bỏ header do khách tự gửi. Sites thực hiện việc này và sở hữu các route `/signin-with-chatgpt`, `/callback`, `/signout-with-chatgpt`. Không triển khai Worker trực tiếp với các header chưa được xác minh.

Schema nằm trong `db/schema.ts`, migrations trong `drizzle/`. Không tạo bảng lúc runtime. Cho local preview sau khi build, áp dụng mỗi migration chưa chạy theo thứ tự:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_aspiring_thor_girl.sql
pnpm dev
```

## Kiểm tra và giới hạn

TypeScript và bản dựng production được kiểm tra. Renderer được xem ở kích thước desktop/mobile và 16:9/9:16. Các luồng API được kiểm tra trong runtime Worker. QA thao tác toàn bộ giao diện trên trình duyệt và việc ghi/download video trên thiết bị thật chưa thực hiện được trong phiên dựng này.

Các đường dẫn bộ kỷ niệm dùng UUID không được liệt kê công khai; người có link khi album đang chia sẻ đều có thể xem. Đây là link chia sẻ không có mật khẩu. Hai người quản lý cùng chỉnh sửa dùng bản lưu gần nhất.

Xem `docs/REFERENCE_NOTES.md` để biết cách áp dụng các ảnh/khung hình đã xem. Không đưa ảnh kỷ niệm khách hàng hay mã mời quản lý vào GitHub.
