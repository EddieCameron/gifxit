import * as DB from "../server"
import TimedEvent from "./timedevent"

const handlers: Record<string, (metadata: string) => void> = {}

async function deleteTimer(eventId: string, starttime: Date) {
    return DB.queryNoReturn("DELETE FROM timers WHERE event_id=$1 AND start_time=$2", eventId, starttime)
}

export async function checkDBTimers() {
    const timers = await DB.query<TimedEvent>("SELECT * FROM timers");

    // do stuff
    const now = new Date().valueOf();
    for (const timer of timers) {
        const msSince = now - timer.start_time.valueOf();
        const remainingMs = timer.delay_ms - msSince;
        if (remainingMs <= 0) {
            // timer complete, execute now
            await deleteTimer(timer.event_id, timer.start_time);

            const handler = handlers[timer.event_id]
            if (handler != undefined)
                handler( timer.metadata );
        }
        else {
            // set timeout
            setTimeout( async () => {
                // remove from DB
                await deleteTimer(timer.event_id, timer.start_time);

                const handler = handlers[timer.event_id]
                if (handler != undefined)
                    handler( timer.metadata );
            }, remainingMs );
        }
    }
}

export async function addTimer(eventId: string, delayms: number, metadata?: string) {

    const now = new Date();
    await DB.queryNoReturn("INSERT INTO timers(event_id, metadata, start_time, delay_ms) VALUES( $1, $2, $3, $4 )",
        eventId, metadata, now, delayms)
    
    setTimeout( async () => {
        // remove from DB
        await deleteTimer(eventId, now);

        const handler = handlers[eventId]
        if (handler != undefined)
            handler( metadata );
    }, delayms);
}

export async function addTimerDueDate(eventId: string, endTime: Date, metadata?: string) {
    const now = new Date();
    const timerLength = endTime.getTime() - now.getTime();
    return addTimer(eventId, timerLength, metadata);
}

export async function registerEventHandler(eventId: string, handler: (metadata: string) => void) {
    handlers[eventId] = handler;
}
