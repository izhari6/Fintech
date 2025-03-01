export enum TransactionStatus {
  WAITING_FOR_WORKER = 'waiting_for_worker', // ממתינה לעובד פנוי
  DELAYED_PROCESSING = 'delayed_processing', // מושהית (לפני אישור)
  PROCESSING = 'processing', // בעיבוד
  APPROVED = 'approved', // הטרנזקציה אושרה בהצלחה
  RETRYING = 'retrying', // ניסיון חוזר
  RETRYING_INSUFFICIANT_BALANCE = 'retrying_insufficiant_balance', // נסיון חוזר (אין מספיק כסף)
  SENT_TO_DEAD_LETTER_QUEUE = 'sent_to_dead_letter_queue', // נשלחה ל-DLQ
}
