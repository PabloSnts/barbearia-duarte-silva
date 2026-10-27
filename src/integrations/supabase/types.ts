export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          client_id: string | null
          client_name: string
          client_phone: string
          created_at: string
          end_at: string
          id: string
          owner_id: string
          service_ids: string[]
          service_names: string[]
          source: string
          start_at: string
          status: string
          total_price: number
        }
        Insert: {
          client_id?: string | null
          client_name: string
          client_phone?: string
          created_at?: string
          end_at: string
          id?: string
          owner_id?: string
          service_ids?: string[]
          service_names?: string[]
          source?: string
          start_at: string
          status?: string
          total_price?: number
        }
        Update: {
          client_id?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          end_at?: string
          id?: string
          owner_id?: string
          service_ids?: string[]
          service_names?: string[]
          source?: string
          start_at?: string
          status?: string
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      blacklist: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          phone: string
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          phone: string
          reason?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          phone?: string
          reason?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string
          owner_id: string
          phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string
          owner_id?: string
          phone?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string
          owner_id?: string
          phone?: string
        }
        Relationships: []
      }
      schedule_adjustments: {
        Row: {
          created_at: string
          day: string
          delta_min: number
          from_appointment_id: string | null
          id: string
          owner_id: string
          previous: Json
          reverted: boolean
        }
        Insert: {
          created_at?: string
          day: string
          delta_min: number
          from_appointment_id?: string | null
          id?: string
          owner_id?: string
          previous: Json
          reverted?: boolean
        }
        Update: {
          created_at?: string
          day?: string
          delta_min?: number
          from_appointment_id?: string | null
          id?: string
          owner_id?: string
          previous?: Json
          reverted?: boolean
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          availability: Json
          created_at: string
          duration_min: number
          id: string
          name: string
          owner_id: string
          price: number
        }
        Insert: {
          active?: boolean
          availability?: Json
          created_at?: string
          duration_min?: number
          id?: string
          name: string
          owner_id?: string
          price?: number
        }
        Update: {
          active?: boolean
          availability?: Json
          created_at?: string
          duration_min?: number
          id?: string
          name?: string
          owner_id?: string
          price?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          absence_message: string
          close_time: string
          open_time: string
          owner_id: string
          shop_name: string
          timezone: string
          tv_name_format: string
          updated_at: string
          vacation_end: string | null
          vacation_start: string | null
          webhook_token: string
          work_days: number[]
        }
        Insert: {
          absence_message?: string
          close_time?: string
          open_time?: string
          owner_id?: string
          shop_name?: string
          timezone?: string
          tv_name_format?: string
          updated_at?: string
          vacation_end?: string | null
          vacation_start?: string | null
          webhook_token?: string
          work_days?: number[]
        }
        Update: {
          absence_message?: string
          close_time?: string
          open_time?: string
          owner_id?: string
          shop_name?: string
          timezone?: string
          tv_name_format?: string
          updated_at?: string
          vacation_end?: string | null
          vacation_start?: string | null
          webhook_token?: string
          work_days?: number[]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_schedule_shift: {
        Args: { p_delta: number; p_from_id: string }
        Returns: string
      }
      get_tv_queue: { Args: { p_owner: string }; Returns: Json }
      revert_schedule_adjustment: { Args: { p_id: string }; Returns: undefined }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
