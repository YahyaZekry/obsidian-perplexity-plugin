export interface ErrorHandler {
    handle(error: Error, context?: string): void;
    log(error: Error, context?: string): void;
    showUserNotification(error: Error, context?: string): void;
}
