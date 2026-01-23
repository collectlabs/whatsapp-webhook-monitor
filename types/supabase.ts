export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      response_config: {
        Row: {
          id: string
          default_message: string
          enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          default_message: string
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          default_message?: string
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          created_at: string | null
          from_number: string
          id: string
          message_body: string | null
          message_id: string
          message_type: string
          raw_payload: Json
          timestamp: number
          to_number: string
        }
        Insert: {
          created_at?: string | null
          from_number: string
          id?: string
          message_body?: string | null
          message_id: string
          message_type: string
          raw_payload: Json
          timestamp: number
          to_number: string
        }
        Update: {
          created_at?: string | null
          from_number?: string
          id?: string
          message_body?: string | null
          message_id?: string
          message_type?: string
          raw_payload?: Json
          timestamp?: number
          to_number?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
