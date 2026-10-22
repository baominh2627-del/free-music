# Bật thư viện nhạc chung cho Pink Tune

Pink Tune đang chạy trên GitHub Pages nên không thể tự nhận tệp tải lên và lưu cho mọi người. Phần thư viện chung dùng Supabase Storage để giữ tệp âm thanh/ảnh và Supabase Database để lưu bài hát, ảnh đại diện công khai. Người nghe chỉ có quyền đọc; đăng tải được giới hạn cho tài khoản có quyền.

## 1. Tạo dự án và kho âm thanh

1. Tạo một project tại [Supabase](https://supabase.com/dashboard).
2. Trong **Storage**, tạo bucket `pink-tune-music`, bật **Public bucket**, đặt giới hạn tệp 50 MB.
3. Trong **SQL Editor**, chạy toàn bộ nội dung `supabase/schema.sql`.
4. Với project đã cài schema cũ, chạy thêm `supabase/community-profile-media.sql` trong SQL Editor để thêm cột ảnh bìa, hồ sơ công khai và quyền tải ảnh đại diện.
5. Trong phần **API Settings**, giữ schema `public` trong danh sách exposed schemas để app đọc catalog qua Data API.

Bucket public cho phép mọi người nghe tệp qua URL. Tài khoản quản trị và tài khoản đăng nhạc được cấp quyền riêng mới có thể tải tệp lên. Không tải nhạc mà bạn không có quyền chia sẻ công khai.

## 2. Tạo tài khoản quản trị

1. Trong **Authentication → Users**, tạo tài khoản email/mật khẩu của bạn. Tắt đăng ký công khai nếu không cần tài khoản người nghe.
2. Sao chép UUID của tài khoản vừa tạo.
3. Chạy trong SQL Editor, thay UUID mẫu bằng UUID của bạn:

```sql
insert into public.pink_tune_admins (user_id)
values ('00000000-0000-0000-0000-000000000000')
on conflict (user_id) do nothing;
```

## 3. Tạo tài khoản đăng nhạc thường

Tài khoản này có thể đăng bài hát nhưng không thấy đường dẫn Table Editor trong app và không có quyền sửa/xóa bài hát.

1. Với dự án đã chạy schema trước đây, chạy nội dung `supabase/uploader-roles-migration.sql` trong SQL Editor để bật vai trò uploader.
2. Triển khai Edge Function `admin-create-uploader`: vào **Edge Functions → Deploy a new function → Via Editor**, đặt tên `admin-create-uploader`, thay mã mẫu bằng nội dung `supabase/functions/admin-create-uploader/index.ts`, rồi bấm **Deploy**. Function dùng secret key được Supabase cấp trong môi trường server; không đưa secret key vào app hoặc GitHub.
3. Tài khoản admin mở Pink Tune → **↑ Đăng nhạc** → điền email và mật khẩu tạm ở mục **Tạo tài khoản đăng nhạc** → bấm **Tạo tài khoản thường**. Hãy gửi mật khẩu cho người dùng qua kênh riêng.

Tài khoản đó đăng nhập trong Pink Tune qua **↑ Đăng nhạc**. Chỉ quản trị viên trong `pink_tune_admins` mới thấy liên kết Table Editor. Nếu không muốn dùng giao diện tạo tài khoản, có thể tạo user trong **Authentication → Users** rồi thêm UID vào `public.pink_tune_uploaders` bằng SQL.

## 4. Kết nối app với project

Trong **Project Settings → API Keys**, lấy Project URL và **publishable key**. Điền vào `supabase-config.js`:

```js
window.PINK_TUNE_CONFIG = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabasePublishableKey: 'sb_publishable_...'
};
```

Publishable key được dùng trong trình duyệt và không phải service-role key. Không đặt `service_role` hoặc secret key trong mã frontend. Row Level Security trong `schema.sql` giới hạn đọc/tải lên.

Sau khi commit và push cấu hình, mở Pink Tune, chọn **↑ Đăng nhạc**, đăng nhập bằng tài khoản có quyền, nhập tên bài/nghệ sĩ, chọn tệp âm thanh và có thể chọn ảnh bìa rồi tải lên. Ảnh đại diện được chỉnh trong **Trang cá nhân** sau khi đăng nhập. Bài hát, ảnh bìa và tên/ảnh hồ sơ người đăng sẽ hiển thị trong **Nhạc cộng đồng** trên các máy mở app.

Mục **Danh sách phát → Dành cho bạn** xếp nhạc theo bài đã thích và lịch sử nghe. Playlist bạn tự tạo được lưu trên thiết bị hiện tại; thư viện này chưa đồng bộ playlist giữa nhiều thiết bị.

## Ghi chú

- Nhạc đã chọn bằng **Thêm bài hát** hoặc **Thêm thư mục** vẫn chỉ nằm trên thiết bị hiện tại; dùng **Đăng nhạc** để đưa bài lên thư viện chung.
- Tệp âm thanh cộng đồng được lưu trong public bucket, vì vậy URL của tệp có thể được truy cập công khai.
- Mức lưu trữ, giới hạn tải lên và băng thông phụ thuộc project Supabase và gói hiện hành.
