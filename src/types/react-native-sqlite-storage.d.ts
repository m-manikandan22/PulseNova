
declare module 'react-native-sqlite-storage' {
    export function enablePromise(enable: boolean): void;
    export function openDatabase(params: { name: string; location: string }): Promise<SQLiteDatabase>;

    export interface SQLiteDatabase {
        executeSql(sql: string, params?: any[]): Promise<[ResultSet]>;
        transaction(callback: (tx: Transaction) => void): Promise<void>;
        close(): Promise<void>;
    }

    export interface Transaction {
        executeSql(sql: string, params?: any[]): Promise<[ResultSet]>;
    }

    export interface ResultSet {
        insertId: number;
        rowsAffected: number;
        rows: {
            length: number;
            item(index: number): any;
        };
    }

    const SQLite: {
        enablePromise: typeof enablePromise;
        openDatabase: typeof openDatabase;
    }
    export default SQLite;
}
