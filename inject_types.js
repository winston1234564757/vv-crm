const fs = require('fs');
let c = fs.readFileSync('src/types/database.ts', 'utf8');

const injection = `      store_launch_categories: {
        Row: {
          id: string
          name: string
          budget_limit: number
          sort_order: number
          color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          budget_limit?: number
          sort_order?: number
          color?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          budget_limit?: number
          sort_order?: number
          color?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_launch_tasks: {
        Row: {
          id: string
          title: string
          status: string
          category_id: string | null
          assignee: string | null
          due_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          status?: string
          category_id?: string | null
          assignee?: string | null
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          status?: string
          category_id?: string | null
          assignee?: string | null
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_launch_tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_launch_categories"
            referencedColumns: ["id"]
          }
        ]
      }
      store_launch_expenses: {
        Row: {
          id: string
          title: string
          amount: number
          category_id: string | null
          type: string
          url: string | null
          status: string
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          amount?: number
          category_id?: string | null
          type?: string
          url?: string | null
          status?: string
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          amount?: number
          category_id?: string | null
          type?: string
          url?: string | null
          status?: string
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_launch_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_launch_categories"
            referencedColumns: ["id"]
          }
        ]
      }
      store_launch_milestones: {
        Row: {
          id: string
          title: string
          target_date: string | null
          is_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          target_date?: string | null
          is_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          target_date?: string | null
          is_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {`;

// Replace the exact lines 1331-1332
c = c.replace(/    \}\r?\n    Views: \{/g, injection);

fs.writeFileSync('src/types/database.ts', c);
console.log('Database types injected with regex');
