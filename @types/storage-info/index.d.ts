interface QuotaStorageEnvironment {
    // Prefixed properties
    webkitTemporaryStorage?: StorageInfo;
    webkitPersistentStorage?: StorageInfo;
    // Properties
    persistentStorage?: StorageInfo;
    temporaryStorage?: StorageInfo;
}

interface StorageInfo {
    /**
     * Queries the current quota and how much data is stored for the host.
     * @param successCallback
     * @param errorCallback
     */
    queryUsageAndQuota(
        successCallback?: StorageInfoUsageCallback,
        errorCallback?: StorageInfoUsageCallback,
    ): void;

    /**
     * Requests a new quota.  Requesting a larger quota may require user's
     * explicit permission via UI prompting / infobar.
     * @param newQuotaInBytes
     * @param successCallback
     * @param errorCallback
     */
    requestQuota(
        newQuotaInBytes: number,
        successCallback: StorageInfoQuotaCallback,
        errorCallback: StorageInfoErrorCallback
    ): void;
}

export interface StorageInfoErrorCallback {
    (error: DOMException): void;
}
export interface StorageInfoQuotaCallback{
    (grantedQuotaInBytes: number): void;
}
export interface StorageInfoUsageCallback {
    (currentUsageInBytes: number, currentQuotaInBytes: number): void
}

declare global {
    interface Navigator extends QuotaStorageEnvironment {
    }
}