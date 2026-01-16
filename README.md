# 📧 Cloudflare Email Worker

> A simple yet powerful Cloudflare Worker that handles contact form submissions and routes emails to your custom address — with optional Google reCAPTCHA Enterprise protection.

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## ✨ Features

- 📬 **Email Routing** — Forward contact form submissions directly to your inbox
- 🎨 **React Email Templates** — Beautiful, customizable HTML emails using React/TSX
- 🛡️ **reCAPTCHA Enterprise** — Optional bot protection with Google reCAPTCHA v3
- 🌐 **CORS Support** — Configure allowed origins for your frontend
- ⚡ **Serverless** — Runs on Cloudflare's global edge network
- 🔒 **Secure** — No backend server needed, runs entirely on Cloudflare

---

## 📋 Prerequisites

Before you begin, ensure you have:

- ✅ A [Cloudflare account](https://dash.cloudflare.com/sign-up) with a domain
- ✅ [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/) enabled for your domain
- ✅ [Node.js](https://nodejs.org/) (v18 or higher) installed
- ✅ [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
- ✅ _(Optional)_ [Google reCAPTCHA Enterprise](https://cloud.google.com/recaptcha-enterprise) project

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
# Clone the repository
git clone <your-repo-url>
cd noreply-mail-worker

# Install dependencies
npm install
```

### 2. Configure Wrangler

Edit the `wrangler.json` file with your settings:

```jsonc
{
	"name": "noreply-mail-worker",
	"main": "src/index.ts",
	"compatibility_date": "2025-09-27",

	// Email configuration
	"send_email": [
		{
			"name": "EMAIL",
			"allowed_destination_addresses": ["your-email@example.com"],
			"remote": true,
		},
	],

	// Environment variables
	"vars": {
		"RECAPTCHA_ENABLED": "false", // Set to "true" to enable reCAPTCHA
		"RECAPTCHA_PROJECT_ID": "", // Your Google Cloud project ID
		"RECAPTCHA_API_KEY": "", // Your reCAPTCHA Enterprise API key
		"RECAPTCHA_SITE_KEY": "", // Your reCAPTCHA site key
		"TO_EMAIL": "your-email@example.com", // Default recipient email
		"FROM_EMAIL": "no-reply@yourdomain.com", // Sender email address
		"AUTHORIZED_ORIGINS": "https://yourdomain.com,https://www.yourdomain.com",
		"ENABLE_LOGGING": "false", // Set to "true" for debug logging
	},
}
```

### 3. Deploy

```bash
# Login to Cloudflare (first time only)
wrangler login

# Deploy to Cloudflare Workers
npm run deploy
```

Your worker will be available at: `https://noreply-mail-worker.<your-subdomain>.workers.dev`

---

## ⚙️ Configuration Reference

### Environment Variables

| Variable               | Required | Description                                                                         |
| ---------------------- | -------- | ----------------------------------------------------------------------------------- |
| `TO_EMAIL`             | ✅       | Default recipient email address for contact form submissions                        |
| `FROM_EMAIL`           | ✅       | The sender address (must use your verified domain, e.g., `no-reply@yourdomain.com`) |
| `AUTHORIZED_ORIGINS`   | ✅       | Comma-separated list of allowed origins for CORS                                    |
| `RECAPTCHA_ENABLED`    | ❌       | Set to `"true"` to enable reCAPTCHA protection (default: `"false"`)                 |
| `RECAPTCHA_PROJECT_ID` | ❌       | Google Cloud project ID (required if reCAPTCHA enabled)                             |
| `RECAPTCHA_API_KEY`    | ❌       | reCAPTCHA Enterprise API key (required if reCAPTCHA enabled)                        |
| `RECAPTCHA_SITE_KEY`   | ❌       | reCAPTCHA site key for frontend (required if reCAPTCHA enabled)                     |
| `ENABLE_LOGGING`       | ❌       | Set to `"true"` for debug logging (default: `"false"`)                              |

### Email Routing Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Email** → **Email Routing**
2. Enable Email Routing for your domain
3. Add the destination email address in `allowed_destination_addresses` in `wrangler.json`
4. Verify the destination email address when prompted

---

## 📨 API Usage

### Endpoint

```
POST https://your-worker-url.workers.dev
```

### Request Format

Send a `multipart/form-data` or `application/x-www-form-urlencoded` POST request with the following fields:

| Field            | Required | Description                                                          |
| ---------------- | -------- | -------------------------------------------------------------------- |
| `message`        | ✅       | Message content (passed to your email template)                      |
| `subject`        | ❌       | Email subject line (default: "New Contact Form Submission")          |
| `to_email`       | ❌       | Override recipient email (defaults to `TO_EMAIL` env variable)       |
| `recaptchaToken` | ❌       | reCAPTCHA token (required if reCAPTCHA enabled)                      |
| _custom fields_  | ❌       | Any additional fields defined in your `DataType` (see customization) |

> 💡 Add custom fields to `DataType` in `src/types.ts` to extend the form data.

### Example: HTML Form

```html
<form action="https://your-worker-url.workers.dev" method="POST">
	<input type="text" name="subject" placeholder="Subject" />
	<textarea name="message" placeholder="Your Message" required></textarea>
	<button type="submit">Send</button>
</form>
```

### Example: JavaScript (Fetch API)

```javascript
const formData = new FormData();
formData.append('subject', 'Contact Form Inquiry');
formData.append('message', 'Hello, this is a test message!');
// Optional: override recipient
// formData.append('to_email', 'other@example.com');

const response = await fetch('https://your-worker-url.workers.dev', {
	method: 'POST',
	body: formData,
});

if (response.ok) {
	console.log('Email sent successfully!');
} else {
	console.error('Failed to send email:', await response.text());
}
```

### Response Codes

| Status | Description                                      |
| ------ | ------------------------------------------------ |
| `200`  | Email sent successfully                          |
| `400`  | Invalid request (missing fields or invalid data) |
| `403`  | reCAPTCHA verification failed                    |
| `405`  | Method not allowed (only POST is accepted)       |
| `500`  | Server error                                     |

---

## 🛡️ Setting Up reCAPTCHA Enterprise (Optional)

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your **Project ID**

### Step 2: Enable reCAPTCHA Enterprise API

1. Navigate to **APIs & Services** → **Library**
2. Search for "reCAPTCHA Enterprise API"
3. Click **Enable**

### Step 3: Create a Site Key

1. Go to **Security** → **reCAPTCHA Enterprise**
2. Click **Create Key**
3. Choose **Score-based (v3)** key type
4. Add your domains
5. Copy the **Site Key**

### Step 4: Create an API Key

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **API Key**
3. Restrict the key to reCAPTCHA Enterprise API
4. Copy the **API Key**

### Step 5: Update Configuration

Update your `wrangler.json`:

```jsonc
"vars": {
  "RECAPTCHA_ENABLED": "true",
  "RECAPTCHA_PROJECT_ID": "your-project-id",
  "RECAPTCHA_API_KEY": "your-api-key",
  "RECAPTCHA_SITE_KEY": "your-site-key",
  // ... other vars
}
```

### Step 6: Frontend Integration

Add reCAPTCHA to your frontend:

```html
<script src="https://www.google.com/recaptcha/enterprise.js?render=YOUR_SITE_KEY"></script>

<script>
	async function submitForm(formData) {
		// Get reCAPTCHA token
		const token = await grecaptcha.enterprise.execute('YOUR_SITE_KEY', {
			action: 'submit_contact_form',
		});

		formData.append('recaptchaToken', token);

		const response = await fetch('https://your-worker-url.workers.dev', {
			method: 'POST',
			body: formData,
		});

		return response;
	}
</script>
```

---

## 🧪 Development

### Local Development

```bash
# Start local development server
wrangler dev
```

The worker will be available at `http://localhost:8787`

---

## 📁 Project Structure

```
noreply-mail-worker/
├── src/
│   ├── index.ts          # Main worker code
│   ├── email-template.tsx # React email template (customize this!)
│   └── types.ts          # TypeScript types (add custom fields here)
├── test/
│   ├── index.spec.ts     # Test files
│   └── tsconfig.json     # Test TypeScript config
├── package.json          # Dependencies & scripts
├── tsconfig.json         # TypeScript configuration
├── vitest.config.mts     # Vitest test configuration
├── wrangler.json         # Cloudflare Worker configuration
└── README.md             # This file
```

---

## 🎨 Customizing Email Templates

### Modifying the Template

Edit `src/email-template.tsx` to customize your email design. The template receives all form data as props:

```tsx
import type { EmailTemplateFunction } from './types';

const Template: EmailTemplateFunction = (props) => {
	return (
		<html>
			<body>
				<h1>New Message</h1>
				<p>{props.message}</p>
				{/* Access custom fields: props.name, props.email, etc. */}
			</body>
		</html>
	);
};
```

> ⚠️ **Important:** Always use inline styles in email templates. External CSS is not supported by email clients.

### Adding Custom Fields

Extend the form data by editing `src/types.ts`:

```typescript
/**
 * Setup your custom DataType here
 */
type DataType = {
	name: string;
	email?: string;
	phone?: string;
	company?: string;
};

/**
 * Do not edit this type definition
 */
export type __EmailWorkerType__ = {
	recaptchaToken?: string;
	subject?: string;
	message: string;
	to_email?: string;
} & DataType;
```

Now you can:

1. Send these fields from your frontend form
2. Access them in your email template via `props.name`, `props.email`, etc.
3. Return an `Error` from the template if validation fails

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ using <a href="https://workers.cloudflare.com/">Cloudflare Workers</a>
</p>
