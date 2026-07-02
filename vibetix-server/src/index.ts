// VibeTix WebAdmin — Cloud Functions Entry Point
// All functions are region-locked to asia-southeast1

// Dashboard
export { getDashboardSummary } from './dashboard/get-dashboard-summary';

// Organizers
export { approveOrganizer, rejectOrganizer } from './organizers/review-organizer';
export { suspendOrganizer } from './organizers/suspend-organizer';

// Events
export { approveEvent, rejectEvent } from './events/review-event';
export { cancelEvent } from './events/cancel-event';
export { featureEvent } from './events/set-event-featured';

// Orders
export { getOrderDetail } from './orders/get-order-detail';

// Payments
export { requestRefund } from './payments/request-refund';

// Promotions
export { createPromotion } from './promotions/create-promotion';
export { setPromotionActive } from './promotions/set-promotion-active';
export { updatePromotion } from './promotions/update-promotion';

// Users
export { getUserDetail } from './users/get-user-detail';
export { listUsers } from './users/list-users';
export { setUserActive } from './users/set-user-active';
export { updateUserStatus, resetUserPassword } from './users/userFunctions';
