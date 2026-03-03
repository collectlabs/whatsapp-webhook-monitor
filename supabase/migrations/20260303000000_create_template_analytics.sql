-- Tabela de analytics diários de templates por WABA.
-- Populada pela rotina de coleta via Meta Graph API /{waba_id}/template_analytics.
CREATE TABLE template_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificadores
  meta_waba_id VARCHAR(255) NOT NULL,
  waba_name    TEXT,
  template_id  VARCHAR(255) NOT NULL,
  template_name TEXT,
  date         DATE NOT NULL,

  -- Métricas de engajamento
  sent      INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0,
  read      INTEGER NOT NULL DEFAULT 0,
  replied   INTEGER NOT NULL DEFAULT 0,

  -- Cliques por botão: [{ "type": "quick_reply_button"|"unique_url_button", "button_content": "...", "count": N }]
  -- Null quando o template não atingiu o mínimo de 1.000 eventos exigido pela Meta.
  clicked JSONB,

  -- Custos
  amount_spent               NUMERIC(12, 4),
  cost_per_delivered         NUMERIC(12, 4),
  cost_per_url_button_click  NUMERIC(12, 4),

  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT template_analytics_unique_per_day
    UNIQUE (meta_waba_id, template_id, date)
);

-- Índices para queries de análise de performance
CREATE INDEX idx_template_analytics_waba_date
  ON template_analytics (meta_waba_id, date DESC);

CREATE INDEX idx_template_analytics_template_date
  ON template_analytics (template_id, date DESC);

CREATE INDEX idx_template_analytics_date
  ON template_analytics (date DESC);
