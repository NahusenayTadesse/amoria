import type { REGISTRATION_STATUSES } from './constants';

export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/**
 * Where a registration may go next, by hand, from the dashboard: the one table both the buttons
 * on the student's page and `school.setRegistrationStatus` read.
 *
 * Getting confirmed by paying is not here: that only happens through a verified payment
 * (`Payable.onPaid`). `expired` is set only by the `expire-holds` job.
 */
export const REGISTRATION_TRANSITIONS: Record<RegistrationStatus, RegistrationStatus[]> = {
	pending_payment: ['cancelled'],
	confirmed: ['cancelled'],
	// Paid after the seat was gone: staff found a seat (rebook) or refunded the student.
	paid_unfulfillable: ['confirmed', 'cancelled'],
	cancelled: [],
	expired: []
};

/** Money has been received for these; cancelling one means a refund. */
export const REGISTRATION_PAID: RegistrationStatus[] = ['confirmed', 'paid_unfulfillable'];

/** Staff wording, for the dashboard (the storefront has its own, translated). */
export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
	pending_payment: 'Awaiting payment',
	confirmed: 'Confirmed',
	cancelled: 'Cancelled',
	expired: 'Expired',
	paid_unfulfillable: 'Paid, no seat'
};

/** The button that moves a registration to each status. */
export const REGISTRATION_ACTION_LABELS: Partial<Record<RegistrationStatus, string>> = {
	confirmed: 'Give a seat: confirm',
	cancelled: 'Cancel registration'
};
