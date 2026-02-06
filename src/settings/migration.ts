import { PerplexityPluginSettings } from '../types';

/**
 * Versioned settings interface that extends the base settings with a version field
 */
export interface VersionedSettings extends PerplexityPluginSettings {
    version: number;
}

/**
 * Current version of the settings schema
 */
export const CURRENT_VERSION = 2;

/**
 * Migration functions for each version
 */
const migrations = {
    '1': (settings: any): VersionedSettings => {
        // Add any new fields with default values
        return {
            ...settings,
            version: 2,
            spellCheckMode: settings.spellCheckMode || 'incremental',
            fullModeChunkSize: settings.fullModeChunkSize || 4000,
            fullModeShowProgress: settings.fullModeShowProgress !== undefined ? settings.fullModeShowProgress : true,
            autoModeThreshold: settings.autoModeThreshold || 3,
            incrementalModeSectionSize: settings.incrementalModeSectionSize || 5000,
            vaultSpellCheckMode: settings.vaultSpellCheckMode || 'full',
            vaultFullModeChunkSize: settings.vaultFullModeChunkSize || 4000,
            vaultAutoModeThreshold: settings.vaultAutoModeThreshold || 2,
            allowModeSwitching: settings.allowModeSwitching !== undefined ? settings.allowModeSwitching : true
        };
    }
};

/**
 * Applies migrations to settings from current version to target version
 * @param settings - The settings to migrate
 * @param targetVersion - The target version to migrate to (defaults to CURRENT_VERSION)
 * @returns The migrated settings
 */
export function migrate(settings: any, targetVersion: number = CURRENT_VERSION): VersionedSettings {
    const currentVersion = settings.version || 1;
    
    // If already at or past target version, return settings as-is
    if (currentVersion >= targetVersion) {
        return {
            ...settings,
            version: currentVersion
        };
    }

    // Apply migrations sequentially
    let migratedSettings = { ...settings };
    for (let i = currentVersion; i < targetVersion; i++) {
        const migrationKey = i.toString();
        const migration = migrations[migrationKey as keyof typeof migrations];
        if (migration) {
            migratedSettings = migration(migratedSettings);
        }
    }

    return {
        ...migratedSettings,
        version: targetVersion
    };
}