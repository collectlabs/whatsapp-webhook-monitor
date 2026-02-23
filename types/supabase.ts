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
      bms: {
        Row: {
          meta_bm_id: string
          bm_uuid: string
          name: string
        }
        Insert: {
          meta_bm_id: string
          bm_uuid?: string
          name: string
        }
        Update: {
          meta_bm_id?: string
          bm_uuid?: string
          name?: string
        }
        Relationships: []
      }
      wabas: {
        Row: {
          meta_waba_id: string
          waba_uuid: string
          bm_uuid: string
          name: string
          phone_ids: Json
        }
        Insert: {
          meta_waba_id: string
          waba_uuid?: string
          bm_uuid: string
          name: string
          phone_ids?: Json
        }
        Update: {
          meta_waba_id?: string
          waba_uuid?: string
          bm_uuid?: string
          name?: string
          phone_ids?: Json
        }
        Relationships: []
      }
      phone_numbers: {
        Row: {
          meta_phone_number_id: string
          waba_uuid: string
          display_phone_number: string | null
          enabled_for_sending: boolean
          auto_reply_enabled: boolean
          auto_reply_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          meta_phone_number_id: string
          waba_uuid: string
          display_phone_number?: string | null
          enabled_for_sending?: boolean
          auto_reply_enabled?: boolean
          auto_reply_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          meta_phone_number_id?: string
          waba_uuid?: string
          display_phone_number?: string | null
          enabled_for_sending?: boolean
          auto_reply_enabled?: boolean
          auto_reply_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_messages: {
        Row: {
          created_at: string | null
          from_number: string
          id: string
          message_body: string | null
          message_id: string
          message_type: string
          raw_payload: Json
          timestamp: number
          meta_waba_id: string | null
          waba_name: string | null
          meta_phone_number_id: string | null
          meta_bm_id: string | null
          bm_name: string | null
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
          meta_waba_id?: string | null
          waba_name?: string | null
          meta_phone_number_id?: string | null
          meta_bm_id?: string | null
          bm_name?: string | null
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
          meta_waba_id?: string | null
          waba_name?: string | null
          meta_phone_number_id?: string | null
          meta_bm_id?: string | null
          bm_name?: string | null
        }
        Relationships: []
      }
      webhook_alerts: {
        Row: {
          id: string
          meta_waba_id: string | null
          field: string | null
          object: string | null
          entity_type: string | null
          entity_id: string | null
          alert_type: string | null
          alert_severity: string | null
          alert_status: string | null
          alert_description: string | null
          raw_payload: Json
          created_at: string
          meta_bm_id: string | null
          bm_name: string | null
        }
        Insert: {
          id?: string
          meta_waba_id?: string | null
          field?: string | null
          object?: string | null
          entity_type?: string | null
          entity_id?: string | null
          alert_type?: string | null
          alert_severity?: string | null
          alert_status?: string | null
          alert_description?: string | null
          raw_payload: Json
          created_at?: string
          meta_bm_id?: string | null
          bm_name?: string | null
        }
        Update: {
          id?: string
          meta_waba_id?: string | null
          field?: string | null
          object?: string | null
          entity_type?: string | null
          entity_id?: string | null
          alert_type?: string | null
          alert_severity?: string | null
          alert_status?: string | null
          alert_description?: string | null
          raw_payload?: Json
          created_at?: string
          meta_bm_id?: string | null
          bm_name?: string | null
        }
        Relationships: []
      }
      phone_number_meta: {
        Row: {
          meta_phone_number_id: string
          meta_waba_id: string
          quality_rating: string | null
          verified_name: string | null
          fetched_at: string
          meta_bm_id: string | null
          bm_name: string | null
        }
        Insert: {
          meta_phone_number_id: string
          meta_waba_id: string
          quality_rating?: string | null
          verified_name?: string | null
          fetched_at?: string
          meta_bm_id?: string | null
          bm_name?: string | null
        }
        Update: {
          meta_phone_number_id?: string
          meta_waba_id?: string
          quality_rating?: string | null
          verified_name?: string | null
          fetched_at?: string
          meta_bm_id?: string | null
          bm_name?: string | null
        }
        Relationships: []
      }
      waba_health_status: {
        Row: {
          meta_waba_id: string
          meta_bm_id: string | null
          bm_status: string | null
          waba_status: string | null
          app_id: string | null
          app_status: string | null
          fetched_at: string
          bm_name: string | null
          bm_uuid: string | null
        }
        Insert: {
          meta_waba_id: string
          meta_bm_id?: string | null
          bm_status?: string | null
          waba_status?: string | null
          app_id?: string | null
          app_status?: string | null
          fetched_at?: string
          bm_name?: string | null
          bm_uuid?: string | null
        }
        Update: {
          meta_waba_id?: string
          meta_bm_id?: string | null
          bm_status?: string | null
          waba_status?: string | null
          app_id?: string | null
          app_status?: string | null
          fetched_at?: string
          bm_name?: string | null
          bm_uuid?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          meta_phone_number_id: string
          recipient_phone: string
          message_type: string
          template_name: string | null
          message_content: string
          status: string
          whatsapp_message_id: string | null
          error_message: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
          sent_at: string | null
          delivered_at: string | null
          read_at: string | null
          meta_waba_id: string | null
          waba_name: string | null
          meta_bm_id: string | null
          bm_name: string | null
        }
        Insert: {
          id?: string
          meta_phone_number_id: string
          recipient_phone: string
          message_type: string
          template_name?: string | null
          message_content: string
          status?: string
          whatsapp_message_id?: string | null
          error_message?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          meta_waba_id?: string | null
          waba_name?: string | null
          meta_bm_id?: string | null
          bm_name?: string | null
        }
        Update: {
          id?: string
          meta_phone_number_id?: string
          recipient_phone?: string
          message_type?: string
          template_name?: string | null
          message_content?: string
          status?: string
          whatsapp_message_id?: string | null
          error_message?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          meta_waba_id?: string | null
          waba_name?: string | null
          meta_bm_id?: string | null
          bm_name?: string | null
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
