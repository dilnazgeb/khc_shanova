/**
 * Mock Data Service для локальной разработки
 * Использует localStorage для хранения данных вместо Wix API
 */

interface QueryOptions {
  limit?: number;
  offset?: number;
}

interface QueryResult<T> {
  items: T[];
  totalCount: number;
}

export class MockDataService {
  private static PREFIX = 'wix_mock_';

  /**
   * Получить все элементы коллекции
   */
  static async getAll<T>(collectionId: string, filter?: any, options?: QueryOptions): Promise<QueryResult<T>> {
    try {
      const key = `${this.PREFIX}${collectionId}`;
      const data = localStorage.getItem(key);
      
      let items: T[] = data ? JSON.parse(data) : [];
      
      // Применить limit и offset
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      
      const paginatedItems = items.slice(offset, offset + limit);
      
      return {
        items: paginatedItems,
        totalCount: items.length
      };
    } catch (error) {
      console.error(`Error getting all from ${collectionId}:`, error);
      return { items: [], totalCount: 0 };
    }
  }

  /**
   * Создать новый элемент
   */
  static async create<T extends { _id: string }>(
    collectionId: string,
    item: T
  ): Promise<T> {
    try {
      const key = `${this.PREFIX}${collectionId}`;
      const data = localStorage.getItem(key);
      
      let items: T[] = data ? JSON.parse(data) : [];
      
      // Добавить новый элемент
      items.push(item);
      
      // Сохранить в localStorage
      localStorage.setItem(key, JSON.stringify(items));
      
      console.log(`Created item in ${collectionId}:`, item._id);
      return item;
    } catch (error) {
      console.error(`Error creating in ${collectionId}:`, error);
      throw error;
    }
  }

  /**
   * Обновить элемент
   */
  static async update<T extends { _id: string }>(
    collectionId: string,
    item: T
  ): Promise<T> {
    try {
      const key = `${this.PREFIX}${collectionId}`;
      const data = localStorage.getItem(key);
      
      let items: T[] = data ? JSON.parse(data) : [];
      
      // Найти и обновить элемент
      const index = items.findIndex(i => i._id === item._id);
      if (index >= 0) {
        items[index] = item;
      } else {
        items.push(item);
      }
      
      // Сохранить в localStorage
      localStorage.setItem(key, JSON.stringify(items));
      
      console.log(`Updated item in ${collectionId}:`, item._id);
      return item;
    } catch (error) {
      console.error(`Error updating in ${collectionId}:`, error);
      throw error;
    }
  }

  /**
   * Удалить элемент
   */
  static async delete(collectionId: string, itemId: string): Promise<void> {
    try {
      const key = `${this.PREFIX}${collectionId}`;
      const data = localStorage.getItem(key);
      
      if (!data) return;
      
      let items = JSON.parse(data);
      items = items.filter((i: any) => i._id !== itemId);
      
      localStorage.setItem(key, JSON.stringify(items));
      
      console.log(`Deleted item from ${collectionId}:`, itemId);
    } catch (error) {
      console.error(`Error deleting from ${collectionId}:`, error);
      throw error;
    }
  }

  /**
   * Очистить коллекцию (для тестирования)
   */
  static clearCollection(collectionId: string): void {
    const key = `${this.PREFIX}${collectionId}`;
    localStorage.removeItem(key);
    console.log(`Cleared collection: ${collectionId}`);
  }

  /**
   * Очистить все данные (для тестирования)
   */
  static clearAll(): void {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(this.PREFIX));
    keys.forEach(key => localStorage.removeItem(key));
    console.log('Cleared all mock data');
  }
}
