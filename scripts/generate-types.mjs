import fs from 'fs';

const schemaPath = 'schema.json';
const outputPath = 'src/types/database.ts';

if (!fs.existsSync(schemaPath)) {
  console.error('schema.json not found!');
  process.exit(1);
}

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const definitions = schema.definitions || {};

function mapType(prop, isRequired, colName, isWrite = false) {
  let tsType = 'any';
  
  if (prop.format === 'jsonb' || prop.format === 'json' || prop.type === 'object') {
    tsType = 'Json';
  } else if (prop.type === 'array') {
    if (prop.items && prop.items.type === 'string') {
      tsType = 'string[]';
    } else if (prop.items && prop.items.type === 'integer') {
      tsType = 'number[]';
    } else {
      tsType = 'any[]';
    }
    if (isWrite) {
      tsType += ' | null';
    }
    return tsType;
  } else if (prop.type === 'integer' || prop.type === 'number') {
    tsType = 'number';
  } else if (prop.type === 'boolean') {
    tsType = 'boolean';
  } else if (prop.type === 'string') {
    tsType = 'string';
  }
  
  if (colName === 'vip_status') {
    tsType = 'string';
  }
  
  if (!isRequired) {
    tsType += ' | null';
  }
  
  return tsType;
}

function getRelationships(properties, tableName) {
  const rels = [];
  for (const [colName, colProps] of Object.entries(properties)) {
    const desc = colProps.description || '';
    const fkMatch = desc.match(/<fk table='([^']+)' column='([^']+)'\/>/) || desc.match(/Foreign Key to `([^`]+)\.([^`]+)`/);
    if (fkMatch) {
      rels.push({
        foreignKeyName: `${tableName}_${colName}_fkey`,
        columns: [colName],
        isOneToOne: false,
        referencedRelation: fkMatch[1],
        referencedColumns: [fkMatch[2]]
      });
    }
  }
  return rels;
}

let content = `export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
`;

for (const tableName of Object.keys(definitions).sort()) {
  const table = definitions[tableName];
  const required = table.required || [];
  const properties = table.properties || {};

  content += `      ${tableName}: {\n`;
  
  // Row
  content += `        Row: {\n`;
  for (const [colName, colProps] of Object.entries(properties)) {
    const isRequired = required.includes(colName);
    content += `          ${colName}: ${mapType(colProps, isRequired, colName, false)}\n`;
  }
  content += `        }\n`;
  
  // Insert
  content += `        Insert: {\n`;
  for (const [colName, colProps] of Object.entries(properties)) {
    const isRequiredInDb = required.includes(colName);
    const hasDefault = colProps.hasOwnProperty('default');
    const isRequiredInInsert = isRequiredInDb && !hasDefault;
    const tsType = mapType(colProps, isRequiredInDb, colName, true);
    
    content += `          ${colName}${isRequiredInInsert ? '' : '?'}: ${tsType}\n`;
  }
  content += `        }\n`;
  
  // Update
  content += `        Update: {\n`;
  for (const [colName, colProps] of Object.entries(properties)) {
    const isRequiredInDb = required.includes(colName);
    const tsType = mapType(colProps, isRequiredInDb, colName, true);
    
    content += `          ${colName}?: ${tsType}\n`;
  }
  content += `        }\n`;
  
  // Relationships
  const rels = getRelationships(properties, tableName);
  content += `        Relationships: [\n`;
  for (const rel of rels) {
    content += `          {\n`;
    content += `            foreignKeyName: "${rel.foreignKeyName}"\n`;
    content += `            columns: ["${rel.columns[0]}"]\n`;
    content += `            isOneToOne: ${rel.isOneToOne}\n`;
    content += `            referencedRelation: "${rel.referencedRelation}"\n`;
    content += `            referencedColumns: ["${rel.referencedColumns[0]}"]\n`;
    content += `          },\n`;
  }
  content += `        ]\n`;
  
  content += `      }\n`;
}

content += `    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      transfer_funds: {
        Args: {
          from_id: string
          from_type: string
          to_id: string
          to_type: string
          amount: number
          desc_text: string | null
          user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
`;

fs.writeFileSync(outputPath, content, 'utf8');
console.log('Database types generated successfully.');
