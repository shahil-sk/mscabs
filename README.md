# Cab Booking Website

A professional, fully responsive cab booking website with Google Forms integration for lead collection.

## Features

- **Service Types**: Outstation, Local, and Airport taxi services
- **Vehicle Selection**: Sedan, SUV, and Hatchback options
- **Lead Collection**: Automatic Google Sheets integration via Google Forms
- **Contact Options**: Click-to-call and WhatsApp integration
- **Responsive Design**: Mobile and desktop optimized
- **SEO Optimized**: Meta tags, semantic HTML, proper heading structure
- **Clean Design**: Taxi-themed yellow and black color scheme

## Quick Start

1. Clone this repository
2. Update contact information in `index.html`
3. Set up Google Forms integration (see Setup Guide below)
4. Deploy to your web hosting

## File Structure

```
cab-booking-website/
├── index.html              # Main HTML file
├── styles.css              # Styling and responsive design
├── script.js               # Form handling and Google Forms integration
├── SETUP_INSTRUCTIONS.txt  # Detailed setup guide
└── README.md              # This file
```

## Setup Guide

### 1. Update Contact Information

In `index.html`, replace:
- Phone numbers: Search for `+919876543210` and replace with your number
- WhatsApp: Update `https://wa.me/919876543210` with your WhatsApp number
- Email: Replace `bookings@cabride.com` with your email

### 2. Google Forms Integration

1. Create a Google Form with the following fields:
   - Full Name (Short Answer)
   - Phone Number (Short Answer)
   - Service Type (Short Answer)
   - Vehicle Type (Short Answer)
   - Pickup Address (Paragraph)
   - Destination (Paragraph)
   - Pickup Date (Short Answer)
   - Pickup Time (Short Answer)
   - Additional Comments (Paragraph)

2. Get form action URL:
   - Click Send button > Embed icon
   - Copy URL and change `viewform` to `formResponse`

3. Get entry IDs:
   - Preview form > View page source
   - Search for `entry.` to find field IDs

4. Update `script.js`:
   - Replace `YOUR_GOOGLE_FORM_ACTION_URL` with your form URL
   - Replace entry IDs in the formParams object

### 3. Deploy

Upload all files to your web hosting service.

## Technologies Used

- HTML5
- CSS3 (Flexbox, Grid, Custom Properties)
- Vanilla JavaScript
- Google Forms API
- Inter Font (Google Fonts)

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Customization

### Colors

Edit CSS variables in `styles.css`:

```css
:root {
    --primary-yellow: #FDB913;
    --dark-gray: #1A1A1A;
    --medium-gray: #2D2D2D;
    --light-gray: #F5F5F5;
}
```

### Business Name

Replace "CabRide" throughout `index.html` with your business name.

## License

Free to use for personal and commercial projects.

## Support

For detailed setup instructions, see `SETUP_INSTRUCTIONS.txt`.
