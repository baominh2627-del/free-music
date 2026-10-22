# Pink Tune

Pink Tune là trình phát nhạc cá nhân miễn phí với giao diện hồng pastel, playlist gợi ý theo sở thích, hồ sơ có ảnh đại diện và ảnh bìa nhạc cộng đồng, cài như ứng dụng trên Android và hỗ trợ phát nền qua trình duyệt. Ứng dụng phát tệp âm thanh do người dùng thêm vào; dự án không bao gồm nhạc thương mại, tài khoản Spotify, hoặc nguồn stream không có giấy phép.

Muốn bật tải nhạc lên thư viện chung để mọi người cùng nghe, cấu hình Supabase theo [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Cài trên điện thoại Android

Ứng dụng web cần được mở từ địa chỉ HTTPS để trình duyệt cho phép cài đặt và lưu ứng dụng ngoại tuyến. Đưa thư mục này lên một máy chủ web HTTPS (ví dụ GitHub Pages), mở đường dẫn trên Chrome Android, rồi chọn **Cài ứng dụng** hoặc **Thêm vào màn hình chính** trong menu trình duyệt. Không cần Play Store.

Muốn cài bằng file APK, tải [Pink Tune APK mới nhất](https://github.com/baominh2627-del/free-music/releases/latest/download/Pink-Tune.apk) trên điện thoại Android, mở file vừa tải và xác nhận cài đặt. GitHub Actions tạo APK sau mỗi lần cập nhật mã app lên nhánh `main`.

Để chạy thử trên máy tính, mở thư mục này bằng máy chủ tĩnh cục bộ, ví dụ `npx serve .`, sau đó truy cập địa chỉ hiện ra. Tính năng cài đặt yêu cầu HTTPS hoặc localhost.

## Dùng ứng dụng

- Chọn **Thêm nhạc** để chép các tệp âm thanh vào thư viện ngoại tuyến của trình duyệt trên thiết bị.
- Dùng **Thêm thư mục** để nhập và nhóm bài hát theo thư mục gốc; có thể mở từng thẻ thư mục trong thư viện.
- Trên điện thoại, thanh điều hướng cố định phía dưới đưa nhanh tới Trang chủ, Tìm kiếm, Thư viện và Bài hát đã thích.
- Phát, tìm kiếm, thích/bỏ thích, phát ngẫu nhiên, lặp lại, tua, điều chỉnh âm lượng và xem hàng đợi.
- Khi phát nhạc, Pink Tune công bố tên bài hát và điều khiển phát/tạm dừng/bài tiếp cho hệ điều hành qua Media Session API. Trên Android Chrome, trình phát có thể tiếp tục khi khóa màn hình; mức hỗ trợ nền tùy trình duyệt và chế độ tiết kiệm pin của thiết bị.
- Chất lượng âm thanh giữ nguyên theo tệp gốc và thiết bị phát. Ứng dụng không nâng cấp bitrate hoặc giả lập chất lượng lossless.

## Giới hạn hiện tại

Đây là ứng dụng web cài thủ công từ trình duyệt (PWA), chưa phải APK Android. Trình duyệt iPhone có giới hạn riêng với phát nền và cài web app. Tệp nhạc được lưu riêng trên thiết bị/trình duyệt hiện tại; xóa dữ liệu trình duyệt có thể xóa thư viện. Muốn phát nhạc thương mại cần thỏa thuận cấp phép và máy chủ phân phối phù hợp.
