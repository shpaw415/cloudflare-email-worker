import type { EmailTemplateFunction } from './types';

const EmailTemplate: EmailTemplateFunction = (props) => {
	const currentDate = new Date().toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});

	return (
		<html>
			<head>
				<meta charSet="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>New Contact Form Submission</title>
			</head>
			<body
				style={{
					margin: 0,
					padding: 0,
					backgroundColor: '#f4f7fa',
					fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
				}}
			>
				{/* Container */}
				<table
					role="presentation"
					style={{
						width: '100%',
						maxWidth: '600px',
						margin: '40px auto',
						backgroundColor: '#ffffff',
						borderRadius: '16px',
						overflow: 'hidden',
						boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
					}}
				>
					{/* Header */}
					<tr>
						<td
							style={{
								background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
								padding: '40px 32px',
								textAlign: 'center',
							}}
						>
							<div
								style={{
									width: '64px',
									height: '64px',
									margin: '0 auto 16px',
									backgroundColor: 'rgba(255, 255, 255, 0.2)',
									borderRadius: '50%',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								<span style={{ fontSize: '32px' }}>✉️</span>
							</div>
							<h1
								style={{
									margin: 0,
									color: '#ffffff',
									fontSize: '28px',
									fontWeight: 700,
									letterSpacing: '-0.5px',
								}}
							>
								New Message Received
							</h1>
							<p
								style={{
									margin: '8px 0 0',
									color: 'rgba(255, 255, 255, 0.85)',
									fontSize: '14px',
								}}
							>
								{currentDate}
							</p>
						</td>
					</tr>

					{/* Content */}
					<tr>
						<td style={{ padding: '32px' }}>
							{/* Message Card */}
							<div
								style={{
									backgroundColor: '#f8fafc',
									borderRadius: '12px',
									padding: '24px',
									borderLeft: '4px solid #667eea',
								}}
							>
								<h2
									style={{
										margin: '0 0 16px',
										color: '#1a1a2e',
										fontSize: '16px',
										fontWeight: 600,
										textTransform: 'uppercase',
										letterSpacing: '0.5px',
									}}
								>
									📝 Message
								</h2>
								<p
									style={{
										margin: 0,
										color: '#4a5568',
										fontSize: '16px',
										lineHeight: 1.7,
										whiteSpace: 'pre-wrap',
									}}
								>
									{props.message}
								</p>
							</div>

							{/* Divider */}
							<hr
								style={{
									border: 'none',
									borderTop: '1px solid #e2e8f0',
									margin: '32px 0',
								}}
							/>

							{/* Quick Actions */}
							<div style={{ textAlign: 'center' }}>
								<p
									style={{
										margin: '0 0 16px',
										color: '#718096',
										fontSize: '14px',
									}}
								>
									Reply directly to this email to respond
								</p>
							</div>
						</td>
					</tr>

					{/* Footer */}
					<tr>
						<td
							style={{
								backgroundColor: '#f8fafc',
								padding: '24px 32px',
								borderTop: '1px solid #e2e8f0',
							}}
						>
							<table role="presentation" style={{ width: '100%' }}>
								<tr>
									<td style={{ textAlign: 'center' }}>
										<p
											style={{
												margin: '0 0 8px',
												color: '#718096',
												fontSize: '13px',
											}}
										>
											This email was sent via your contact form
										</p>
										<p
											style={{
												margin: 0,
												color: '#a0aec0',
												fontSize: '12px',
											}}
										>
											Powered by{' '}
											<span
												style={{
													color: '#667eea',
													fontWeight: 600,
												}}
											>
												Cloudflare Workers
											</span>
										</p>
									</td>
								</tr>
							</table>
						</td>
					</tr>
				</table>

				{/* Branding footer */}
				<BrandingFooter />
			</body>
		</html>
	);
};

function BrandingFooter() {
	return (
		<table role="presentation" style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
			<tr>
				<td style={{ textAlign: 'center', padding: '16px' }}>
					<p
						style={{
							margin: 0,
							color: '#a0aec0',
							fontSize: '11px',
						}}
					>
						© {new Date().getFullYear()} Your Company. All rights reserved.
					</p>
				</td>
			</tr>
		</table>
	);
}

export default EmailTemplate;
