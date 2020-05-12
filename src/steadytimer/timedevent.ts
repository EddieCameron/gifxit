export default interface TimedEvent {
    event_id: string;
    metadata?: string;

    start_time: Date;
    delay_ms: number;
}