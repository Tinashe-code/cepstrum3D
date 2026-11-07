import { siteConfig } from "@/config/site"
const links = {
  customerServices: [
    { label: 'Help & FAQs', path: '#' },
    { label: 'Track Order', path: '/user/orders' },
    { label: 'Returns', path: '#' },
    { label: 'Delivery in Zimbabwe', path: '#' },
    { label: 'Payment (EcoCash, OneMoney, Card)', path: '#' },
  ],
  about: [
    { label: `About ${siteConfig.name}`, path: '#' },
    { label: `Sell on ${siteConfig.name}`, path: process.env.NEXT_PUBLIC_VENDOR_URL || '#' },
    { label: 'Privacy Policy', path: '#' },
    { label: 'Terms & Conditions', path: '#' },
  ],
  connect: [
    { label: 'Facebook', path: 'https://facebook.com' },
    { label: 'Instagram', path: 'https://instagram.com' },
    { label: 'LinkedIn', path: 'https://linkedin.com' },
    { label: 'WhatsApp', path: 'https://wa.me/' },
  ],
};

export default links;
