export interface Document {
  id: string;
  title: string;
  content: unknown;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}
