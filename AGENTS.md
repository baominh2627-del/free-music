# Pink Tune interface requirements

- Design every interface mobile-first. Treat the phone layout as the primary product interface, not a desktop page scaled down afterward.
- Keep layouts fluid and sized to the device viewport. Avoid fixed widths that cause clipping or horizontal scrolling; account for notches and system bars with safe-area insets.
- Check phone layouts at common CSS viewport widths from 320px to 430px, in portrait and installed PWA mode. Keep text readable, controls easy to tap, and the player/navigation clear of page content.
- Add desktop enhancements only after the mobile layout works at the intended phone proportions.
