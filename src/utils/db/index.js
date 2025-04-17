// 数据库配置
const DB_NAME = 'drift-pulse-zero';
const DB_VERSION = 1;

// 存储对象配置
const STORES = {
    VEHICLES: 'vehicles',
    FAVORITES: 'favorites',
    USER_SETTINGS: 'userSettings'
};

class IndexedDB {
    constructor() {
        this.db = null;
        this.dbInitPromise = this.initDB();
        this.transactionTimeoutMap = new Map(); // 跟踪事务超时
        this.pendingOperations = new Map(); // 存储待处理的操作
    }

    // 序列化数据
    serializeData(data) {
        return JSON.parse(JSON.stringify(data));
    }

    // 初始化数据库
    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error('数据库打开失败:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                
                // 添加错误处理
                this.db.onerror = (event) => {
                    console.error("数据库错误:", event.target.error);
                };
                
                console.log('数据库连接成功');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 创建存储对象
                if (!db.objectStoreNames.contains(STORES.VEHICLES)) {
                    db.createObjectStore(STORES.VEHICLES, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.FAVORITES)) {
                    db.createObjectStore(STORES.FAVORITES, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.USER_SETTINGS)) {
                    db.createObjectStore(STORES.USER_SETTINGS, { keyPath: 'id' });
                }
            };
        });
    }

    // 确保数据库已初始化
    async ensureDB() {
        if (!this.db) {
            await this.dbInitPromise;
        }
        return this.db;
    }

    // 创建事务
    createTransaction(storeNames, mode = 'readonly') {
        if (!this.db) {
            throw new Error('数据库尚未初始化');
        }
        
        const transaction = this.db.transaction(storeNames, mode);
        
        // 加入事务错误处理
        transaction.onerror = (event) => {
            console.error('事务失败:', event.target.error);
        };
        
        return transaction;
    }
    
    // 批量操作函数 - 合并多个写操作到单个事务中
    async batchOperation(storeName, operations) {
        try {
            const db = await this.ensureDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                
                transaction.oncomplete = () => {
                    resolve(true);
                };
                
                transaction.onerror = () => {
                    reject(transaction.error);
                };
                
                // 执行所有操作
                operations.forEach(operation => {
                    const { type, data, key } = operation;
                    try {
                        switch (type) {
                            case 'add':
                                store.add(this.serializeData(data));
                                break;
                            case 'put':
                                store.put(this.serializeData(data));
                                break;
                            case 'delete':
                                store.delete(key);
                                break;
                            default:
                                console.warn(`未知操作类型: ${type}`);
                        }
                    } catch (error) {
                        console.error(`批量操作执行失败: ${type}`, error);
                    }
                });
            });
        } catch (error) {
            console.error('批量操作失败:', error);
            return false;
        }
    }

    // 通用的添加数据方法
    async add(storeName, data) {
        try {
            const db = await this.ensureDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const serializedData = this.serializeData(data);
                
                // 添加事务完成事件监听
                transaction.oncomplete = () => {
                    resolve(true);
                };
                
                transaction.onerror = (event) => {
                    console.error(`添加数据到 ${storeName} 失败:`, event.target.error);
                    reject(event.target.error);
                };
                
                // 执行添加操作
                store.add(serializedData);
            });
        } catch (error) {
            console.error(`添加数据到 ${storeName} 失败:`, error);
            return false;
        }
    }

    // 通用的获取数据方法
    async get(storeName, id) {
        try {
            const db = await this.ensureDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(id);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => {
                    console.error(`从 ${storeName} 获取数据失败:`, request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error(`从 ${storeName} 获取数据失败:`, error);
            return null;
        }
    }

    // 通用的更新数据方法
    async update(storeName, data) {
        try {
            const db = await this.ensureDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const serializedData = this.serializeData(data);
                
                // 添加事务完成事件监听
                transaction.oncomplete = () => {
                    console.log(`更新 ${storeName} 数据成功`);
                    resolve(true);
                };
                
                transaction.onerror = (event) => {
                    console.error(`更新 ${storeName} 数据失败:`, event.target.error);
                    reject(event.target.error);
                };
                
                // 执行更新
                store.put(serializedData);
            });
        } catch (error) {
            console.error(`更新 ${storeName} 数据失败:`, error);
            return false;
        }
    }

    // 通用的删除数据方法
    async delete(storeName, id) {
        try {
            const db = await this.ensureDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                
                // 添加事务完成事件监听
                transaction.oncomplete = () => {
                    resolve(true);
                };
                
                transaction.onerror = (event) => {
                    console.error(`从 ${storeName} 删除数据失败:`, event.target.error);
                    reject(event.target.error);
                };
                
                // 执行删除
                store.delete(id);
            });
        } catch (error) {
            console.error(`从 ${storeName} 删除数据失败:`, error);
            return false;
        }
    }

    // 获取存储对象中的所有数据
    async getAll(storeName) {
        try {
            const db = await this.ensureDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => {
                    console.error(`获取所有 ${storeName} 数据失败:`, request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error(`获取所有 ${storeName} 数据失败:`, error);
            return [];
        }
    }

    // 清空存储对象
    async clear(storeName) {
        try {
            const db = await this.ensureDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                
                // 添加事务完成事件监听
                transaction.oncomplete = () => {
                    resolve(true);
                };
                
                transaction.onerror = (event) => {
                    console.error(`清空 ${storeName} 失败:`, event.target.error);
                    reject(event.target.error);
                };
                
                // 执行清空
                store.clear();
            });
        } catch (error) {
            console.error(`清空 ${storeName} 失败:`, error);
            return false;
        }
    }
}

// 导出单例实例
export const db = new IndexedDB();
export { STORES }; 