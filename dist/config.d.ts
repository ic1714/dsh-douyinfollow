import type { Volatile } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import type { ScheduleMode } from './types.js';
/** 插件配置：全部 volatile，既进设置页表单，也支持运行中热读取。 */
export interface Config {
    enabled: Volatile<boolean>;
    keywords: Volatile<string[]>;
    intervalMinutes: Volatile<number>;
    scheduleMode: Volatile<string>;
    activeWindows: Volatile<string[]>;
    idleQuietSeconds: Volatile<number>;
    maxVideosPerPatrol: Volatile<number>;
    ocrEnabled: Volatile<boolean>;
    aiSummaryEnabled: Volatile<boolean>;
    frameCount: Volatile<number>;
    headlessPatrol: Volatile<boolean>;
    browserChannel: Volatile<string>;
    dataDir: Volatile<string>;
    loginTimeoutSeconds: Volatile<number>;
    retentionCards: Volatile<number>;
    pricingJson: Volatile<string>;
}
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    enabled: Schema<boolean, boolean, "volatile-defined">;
    keywords: Schema<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
    intervalMinutes: Schema<number, number, "volatile-defined">;
    scheduleMode: Schema<string, string, "volatile-defined">;
    activeWindows: Schema<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
    idleQuietSeconds: Schema<number, number, "volatile-defined">;
    maxVideosPerPatrol: Schema<number, number, "volatile-defined">;
    ocrEnabled: Schema<boolean, boolean, "volatile-defined">;
    aiSummaryEnabled: Schema<boolean, boolean, "volatile-defined">;
    frameCount: Schema<number, number, "volatile-defined">;
    headlessPatrol: Schema<boolean, boolean, "volatile-defined">;
    browserChannel: Schema<string, string, "volatile-defined">;
    dataDir: Schema<string, string, "volatile-defined">;
    loginTimeoutSeconds: Schema<number, number, "volatile-defined">;
    retentionCards: Schema<number, number, "volatile-defined">;
    pricingJson: Schema<string, string, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    enabled: Schema<boolean, boolean, "volatile-defined">;
    keywords: Schema<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
    intervalMinutes: Schema<number, number, "volatile-defined">;
    scheduleMode: Schema<string, string, "volatile-defined">;
    activeWindows: Schema<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
    idleQuietSeconds: Schema<number, number, "volatile-defined">;
    maxVideosPerPatrol: Schema<number, number, "volatile-defined">;
    ocrEnabled: Schema<boolean, boolean, "volatile-defined">;
    aiSummaryEnabled: Schema<boolean, boolean, "volatile-defined">;
    frameCount: Schema<number, number, "volatile-defined">;
    headlessPatrol: Schema<boolean, boolean, "volatile-defined">;
    browserChannel: Schema<string, string, "volatile-defined">;
    dataDir: Schema<string, string, "volatile-defined">;
    loginTimeoutSeconds: Schema<number, number, "volatile-defined">;
    retentionCards: Schema<number, number, "volatile-defined">;
    pricingJson: Schema<string, string, "volatile-defined">;
}>>, "plain">;
/** 运行中读取的配置快照（每次操作开始时取一次）。 */
export interface FollowConfig {
    enabled: boolean;
    keywords: string[];
    intervalMinutes: number;
    scheduleMode: ScheduleMode;
    activeWindows: string[];
    idleQuietSeconds: number;
    maxVideosPerPatrol: number;
    ocrEnabled: boolean;
    aiSummaryEnabled: boolean;
    frameCount: number;
    headlessPatrol: boolean;
    browserChannel: string;
    dataDir: string;
    loginTimeoutSeconds: number;
    retentionCards: number;
    pricingJson: string;
}
export declare function readConfig(config: Config): FollowConfig;
