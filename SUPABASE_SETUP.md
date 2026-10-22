# Bật thư viện nhạc chung cho Pink Tune

Pink Tune đang chạy trên GitHub Pages nên không thể tự nhận tệp tải lên và lưu cho mọi người. Phần thư viện chung dùng Supabase Storage để giữ tệp âm thanh và Supabase Database để lưu tên bài/nghệ sĩ. Người nghe chỉ có quyền đọc; đăng tải được giới hạn cho tài khoản quản trị.

## 1. Tạo dự án và kho âm thanh

1. Tạo một project tại [Supabase](https://supabase.com/dashboard).
2. Trong **Storage**, tạo bucket `pink-tune-music`, bật **Public bucket**, đặt giới hạn tệp 50 MB.
3. Trong **SQL Editor**, chạy toàn bộ nội dung `supabase/schema.sql`.
4. Trong phần **API Settings**, giữ schema `public` trong danh sách exposed schemas để app đọc catalog qua Data API.

Bucket public cho phép mọi người nghe tệp qua URL; chỉ tài khoản được thêm vào bảng quản trị mới có policy tải tệp lên. Không tải nhạc mà bạn không có quyền chia sẻ công khai.

## 2. Tạo tài khoản quản trị

1. Trong **Authentication → Users**, tạo tài khoản email/mật khẩu của bạn. Tắt đăng ký công khai nếu không cần tài khoản người nghe.
2. Sao chép UUID của tài khoản vừa tạo.
3. Chạy trong SQL Editor, thay UUID mẫu bằng UUID của bạn:

```sql
insert into public.pink_tune_admins (user_id)
values ('00000000-0000-0000-0000-000000000000')
on conflict (user_id) do nothing;
```

## 3. Kết nối app với project

Trong **Project Settings → API Keys**, lấy Project URL và **publishable key**. Điền vào `supabase-config.js`:

```js
window.PINK_TUNE_CONFIG = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabasePublishableKey: 'sb_publishable_...'
};
```

Publishable key được dùng trong trình duyệt và không phải service-role key. Không đặt `service_role` hoặc secret key trong mã frontend. Row Level Security trong `schema.sql` giới hạn đọc/tải lên.

Sau khi commit và push cấu hình, mở Pink Tune, chọn **↑ Đăng nhạc**, đăng nhập bằng tài khoản quản trị, nhập tên bài/nghệ sĩ rồi chọn tệp và tải lên. Bài hát sẽ xuất hiện ở mục **Nhạc cộng đồng** trên các máy mở trang.

## Ghi chú

- Nhạc đã chọn bằng **Thêm bài hát** hoặc **Thêm thư mục** vẫn chỉ nằm trên thiết bị hiện tại; dùng **Đăng nhạc** để đưa bài lên thư viện chung.
- Tệp âm thanh cộng đồng được lưu trong public bucket, vì vậy URL của tệp có thể được truy cập công khai.
- Mức lưu trữ, giới hạn tải lên và băng thông phụ thuộc project Supabase và gói hiện hành.
