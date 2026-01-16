/**
 * Setup your custom DataType here
 */
type DataType = {
	// name: string,
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

/**
 * Your email template component goes here.
 * You can use props to access the data sent to the worker.
 * Return Error if something is wrong with the data.
 * - **Remember to inline styles if needed as external CSS files are not supported in email templates.**
 * - **plain text templates is supported**
 */
export type EmailTemplateFunction = (props: __EmailWorkerType__) => React.ReactElement | string | Error;
