export interface Column {
  name: string;
  type: string;
  description: string;
}

export interface DatabaseTable {
  name: string;
  database: string;
  totalColumns: number;
  columns: Column[];
}

export interface Database {
  name: string;
  tables: DatabaseTable[];
  color: string;
}

export interface DatabaseSchema {
  databases: Database[];
  totalTables: number;
  totalColumns: number;
  describedColumns: number;
}

export interface CodeSnippet {
  id: string;
  title: string;
  description: string;
  language: 'python' | 'sql' | 'bash' | 'other';
  code: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
