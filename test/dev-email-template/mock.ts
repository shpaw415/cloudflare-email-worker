import type { __EmailWorkerType__ } from '../../src/types';
export const mockData: __EmailWorkerType__ = {
	transportType: 'Bus',
	name: 'John Doe',
	email: 'john.doe@example.com',
	message: 'Hello, I am interested in your bus services. Please provide more information.',
	phone: '123-456-7890',
} as const;
