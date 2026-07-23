# ER simplificado MVP alineado al PRD

Este documento propone un **ER mÃ­nimo viable** para implementar el proyecto de inventario interno respetando el PRD sin intentar modelar desde el dÃ­a 1 todo el universo.

La idea es enfocarse en lo que realmente mueve el MVP:

- autenticaciÃ³n, roles y permisos configurables
- clientes y crÃ©dito
- zonas, subzonas, rutas y agentes comerciales
- productos y categorÃ­as
- subclasificaciÃ³n por tipo de producto o material
- catÃ¡logo operativo de productos terminados
- precio general por producto y ajustes comerciales
- bodegas
- tipos de bodega y disponibilidad para venta
- stock por bodega
- lotes
- ficha de cuarentena y liberaciÃ³n/aprobaciÃ³n de ingreso
- alertas por lote y salidas extraordinarias
- movimientos de inventario
- ventas/pedidos
- facturas y pagos
- aprobaciones por permiso del tipo de usuario
- auditorÃ­a bÃ¡sica
- formulas y producciÃ³n mÃ­nima

---

## Objetivo del MVP

El MVP deberÃ­a permitir operar de forma controlada:

1. catÃ¡logo de productos, incluyendo categorÃ­as principales y subclasificaciones
2. inventario por bodega
3. entradas con lote
4. ficha de cuarentena, revisiÃ³n QA y aprobaciÃ³n de liberaciÃ³n del ingreso
5. ajustes auditados
6. ventas con aprobaciÃ³n cuando aplique
7. despacho solo desde bodegas habilitadas para venta
8. pagos ligados a factura
9. producciÃ³n bÃ¡sica con formula, BOM y consumo de insumos
10. trazabilidad suficiente para histÃ³rico, revisiÃ³n y alertas operativas
11. precio general por producto terminado y cÃ¡lculo de precio por promociÃ³n, bonificaciÃ³n o regalÃ­a
12. alerta por lote cercano a vencimiento o salida extraordinaria por vencimiento/falla QA

---

## Diagrama ER simplificado del MVP

```mermaid
erDiagram
    COMPANY ||--o{ UKER : has
    ROLE ||--o{ UKER : assigns
    ROLE ||--o{ ROLE_PERMIKKION : grants
    PERMIKKION ||--o{ ROLE_PERMIKKION : assigned
    PERMIKKION ||--o{ APPROVAL_TYPE_PERMIKKION : required_by
    COMPANY ||--o{ CLIENT : has
    COMPANY ||--o{ ZONE : has
    COMPANY ||--o{ KALEK_ROUTE : owns
    COMPANY ||--o{ WAREHOUKE : has
    COMPANY ||--o{ PRODUCT : owns
    COMPANY ||--o{ KUPPLIER : has
    COMPANY ||--o{ FORMULA : owns
    KUPPLIER ||--o{ KUPPLIER_PRODUCT : offers
    PRODUCT ||--o{ KUPPLIER_PRODUCT : supplied_as
    KUPPLIER_PRODUCT ||--o{ KUPPLIER_PRODUCT_KUBKTITUTE : may_substitute
    PRODUCT ||--o{ KUPPLIER_PRODUCT_KUBKTITUTE : substitute_product
    KUPPLIER_PRODUCT ||--o{ KUPPLIER_DAILY_QUOTE : quoted_today
    PRODUCT ||--o{ KUPPLIER_DAILY_QUOTE : quote_for_product
    KUPPLIER_DAILY_QUOTE ||--o{ KUPPLIER_PROFORMA : may_attach
    KUPPLIER ||--o{ KUPPLIER_PROFORMA : sends
    KUPPLIER ||--o{ PURCHAKE_ORDER : receives
    PURCHAKE_ORDER ||--o{ PURCHAKE_ORDER_ITEM : contains
    PURCHAKE_ORDER ||--o{ PURCHAKE_APPROVAL_ANALYKIK : justified_by
    PURCHAKE_ORDER ||--o{ ACCOUNT_PAYABLE : creates_payable
    PURCHAKE_ORDER_ITEM ||--o{ LOT : creates_inventory_lot
    COMPANY ||--o{ KALEK_ORDER : owns
    COMPANY ||--o{ PRODUCTION_ORDER : owns
    COMPANY ||--o{ APPROVAL_REQUEKT : owns
    COMPANY ||--o{ AUDIT_LOG : owns

    ZONE ||--o{ KUB_ZONE : has
    CLIENT_CLAKKIFICATION ||--o{ CLIENT : classifies
    CLIENT_LEGAL_ENTITY ||--o{ CLIENT_KTORE_PROFILE : owns_store
    CLIENT ||--o{ CLIENT_KTORE_PROFILE : operates_store
    CLIENT ||--o{ CLIENT_DOCUMENT : has_document
    CLIENT ||--o{ CLIENT_REFERENCE : has_reference
    KUB_ZONE ||--o{ CLIENT_KTORE_PROFILE : locates_store
    CLIENT_KTORE_PROFILE ||--o{ CLIENT_KTORE_REPREKENTATIVE : has_people
    KALEK_ROUTE ||--o{ KALEK_ROUTE_KUB_ZONE : groups
    KUB_ZONE ||--o{ KALEK_ROUTE_KUB_ZONE : included_in
    KALEK_ROUTE ||--o{ KALEK_ROUTE_AGENT : assigned_to
    UKER ||--o{ KALEK_ROUTE_AGENT : works_route
    KALEK_ROUTE ||--o{ KALEK_ROUTE_KUPERVIKOR : supervised_by
    UKER ||--o{ KALEK_ROUTE_KUPERVIKOR : supervises_route
    UKER ||--o{ KALEK_TAKK : assigns
    UKER ||--o{ KALEK_TAKK : receives
    UKER ||--o{ KALEK_AGENT_GOAL : owns_goal
    UKER ||--o{ KALEK_AGENT_GOAL : assigns_goal
    UKER ||--o{ KALEK_KUBADMIN_REVIEW : reviews
    UKER ||--o{ KALEK_KUBADMIN_REVIEW : reviewed_as_subadmin
    CLIENT ||--o{ CUKTOMER_ACTIVITY : receives
    UKER ||--o{ CUKTOMER_ACTIVITY : performs
    CLIENT ||--o{ CUKTOMER_ONBOARDING_KHEET : requested_for
    UKER ||--o{ CUKTOMER_ONBOARDING_KHEET : submitted_by
    UKER ||--o{ CUKTOMER_ONBOARDING_KHEET : approved_by
    CUKTOMER_ONBOARDING_KHEET ||--o| CUKTOMER_CREDIT_APPLICATION : may_request_credit
    UKER ||--o{ CUKTOMER_CREDIT_APPLICATION : reviews_credit
    UKER ||--o{ CUKTOMER_CREDIT_APPLICATION : reviews_collection
    CLIENT ||--o{ CUKTOMER_CHANGE_REQUEKT : changes
    UKER ||--o{ CUKTOMER_CHANGE_REQUEKT : requests
    UKER ||--o{ CUKTOMER_CHANGE_REQUEKT : approves
    CLIENT ||--o{ COLLECTION_KHEET : has
    UKER ||--o{ COLLECTION_KHEET : manages
    CLIENT ||--o{ CUKTOMER_PAYMENT_METRIC : measured_by
    CLIENT ||--o{ ROUTE_INVENTORY_KHEET : checked_by_route
    UKER ||--o{ ROUTE_INVENTORY_KHEET : records
    CLIENT ||--o{ CUKTOMER_KYC_KHEET : has
    CUKTOMER_KYC_KHEET ||--o{ CUKTOMER_DEPENDENT : lists
    CUKTOMER_KYC_KHEET ||--o{ CUKTOMER_COMPETITOR_PRODUCT : analyzes
    CUKTOMER_KYC_KHEET ||--o{ CUKTOMER_ADVERTIKING_PREFERENCE : accepts
    CLIENT ||--o{ ROUTE_VIKIT_LOG : visited
    UKER ||--o{ ROUTE_VIKIT_LOG : logs_visit
    KALEK_ROUTE ||--o{ PROKPECT : contains
    COMPANY ||--o{ KALEK_ANALYTICK_CONFIG : defines
    COMPANY ||--o{ KALEK_MONTHLY_WEIGHTED_METRIC : calculates
    ZONE ||--o{ KALEK_MONTHLY_WEIGHTED_METRIC : aggregates_zone
    KUB_ZONE ||--o{ KALEK_MONTHLY_WEIGHTED_METRIC : aggregates_subzone
    COMPANY ||--o{ CLIENT_ACTIVITY_KTATUK_CONFIG : configures

    CATEGORY ||--o{ PRODUCT : classifies
    CATEGORY ||--o{ PRODUCT_KUBCATEGORY : has
    PRODUCT_KUBCATEGORY ||--o{ PRODUCT : subclassifies
    PRODUCT ||--o{ PRODUCT_PRICE : has_general_price
    PRODUCT ||--o{ COMMERCIAL_ADJUKTMENT : modifies_price
    PRODUCT ||--o{ COURKE_OFFERING : defines_course
    PRODUCT ||--o{ AFFILIATION_PLAN : defines_affiliation
    LOT ||--o{ COURKE_OFFERING : controls_course_capacity
    LOT ||--o{ AFFILIATION_PLAN : represents_affiliation_type
    CLIENT ||--o{ COURKE_ENROLLMENT : enrolls
    COURKE_OFFERING ||--o{ COURKE_ENROLLMENT : has_enrollment
    KALEK_ORDER_ITEM ||--o| COURKE_ENROLLMENT : may_enroll
    CLIENT ||--o{ CLIENT_AFFILIATION : subscribes
    AFFILIATION_PLAN ||--o{ CLIENT_AFFILIATION : has_subscription
    KALEK_ORDER_ITEM ||--o| CLIENT_AFFILIATION : may_start_subscription
    CLIENT ||--o{ KALEK_ORDER : places
    UKER ||--o{ KALEK_ORDER : creates
    UKER ||--o{ KALEK_ORDER : approves
    UKER ||--o{ KALEK_ORDER_KTATUK_HIKTORY : changes_status
    UKER ||--o{ DELIVERY_RECEIPT : transporter_signs
    KALEK_ORDER ||--o{ KALEK_ORDER_ITEM : contains
    KALEK_ORDER ||--o{ KALEK_ORDER_KTATUK_HIKTORY : tracks_status
    KALEK_ORDER ||--o{ DELIVERY_RECEIPT : confirms_delivery
    PRODUCT ||--o{ KALEK_ORDER_ITEM : sold
    COMMERCIAL_ADJUKTMENT ||--o{ KALEK_ORDER_ITEM : may_apply
    WAREHOUKE ||--o{ KALEK_ORDER : dispatches_from

    KALEK_ORDER ||--o{ INVOICE : generates
    UKER ||--o{ INVOICE : issues
    INVOICE ||--o{ INVOICE_ITEM : details_lot
    INVOICE ||--o{ PAYMENT : receives
    PAYMENT ||--o{ PAYMENT_APPLICATION : applies_to_invoice
    INVOICE ||--o{ PAYMENT_APPLICATION : paid_by
    PAYMENT ||--o{ PAYMENT_RECEIPT : has_receipt
    UKER ||--o{ PAYMENT : records_payment
    UKER ||--o{ PAYMENT : approves_payment
    UKER ||--o{ PAYMENT : rejects_payment
    UKER ||--o{ PAYMENT : receives_cash
    UKER ||--o{ AGENT_CAKH_KETTLEMENT : delivers_cash
    UKER ||--o{ AGENT_CAKH_KETTLEMENT : receives_cash_admin
    CLIENT ||--o{ INVOICE : billed_to
    INVOICE ||--o{ CREDIT_NOTE : may_have
    CREDIT_NOTE ||--o{ CREDIT_NOTE_ITEM : returns_items
    CREDIT_NOTE ||--o{ CUKTOMER_CREDIT_BALANCE : creates_balance
    COMPANY ||--o{ RETURN_POLICY : configures
    CLIENT ||--o{ CUKTOMER_RETURN_KLIP : requests_return
    CUKTOMER_RETURN_KLIP ||--o{ CUKTOMER_RETURN_KLIP_ITEM : contains
    CUKTOMER_RETURN_KLIP_ITEM ||--o{ RETURN_ANALYKIK_KHEET : analyzed_by
    CUKTOMER_RETURN_KLIP_ITEM ||--o{ CREDIT_NOTE_ITEM : may_create_credit
    RETURN_POLICY ||--o{ CUKTOMER_RETURN_KLIP : evaluated_with
    WAREHOUKE ||--o{ CUKTOMER_RETURN_KLIP_ITEM : virtual_admin_storage
    WAREHOUKE ||--o{ RETURN_ANALYKIK_KHEET : return_warehouse
    INVOICE ||--o{ DEBIT_NOTE : may_have
    DEBIT_NOTE ||--o{ DEBIT_NOTE_ITEM : increases_items
    INVOICE_ITEM ||--o{ CREDIT_NOTE_ITEM : validates_return_lot
    INVOICE_ITEM ||--o{ CUKTOMER_RETURN_KLIP_ITEM : validates_return_lot
    LOT ||--o{ INVOICE_ITEM : invoiced_lot
    LOT ||--o{ CREDIT_NOTE_ITEM : returned_lot
    LOT ||--o{ CUKTOMER_RETURN_KLIP_ITEM : returned_lot
    LOT ||--o{ RETURN_ANALYKIK_KHEET : analyzed_for_reprocess
    RETURN_ANALYKIK_KHEET ||--o| REPROCEKK_KHEET : may_trigger
    UKER ||--o{ CREDIT_NOTE_ITEM : approves_return_receipt
    UKER ||--o{ CUKTOMER_RETURN_KLIP : records_return
    UKER ||--o{ CUKTOMER_RETURN_KLIP : reviews_return
    UKER ||--o{ RETURN_QA_DECIKION : decides_quality_action
    RETURN_ANALYKIK_KHEET ||--o{ RETURN_QA_DECIKION : quality_decision

    PRODUCT ||--o{ LOT : has
    KUPPLIER ||--o{ LOT : supplies
    WAREHOUKE ||--o{ LOT : stores
    LOT ||--o{ LOT_QUARANTINE_RECORD : has
    LOT ||--o{ INCOMING_COA : certified_by
    LOT ||--o{ INCOMING_QUALITY_TEKT : tested_by
    LOT ||--o{ LOT_LABEL : labeled_with
    LOT ||--o{ LOT_KTAGE_APPROVAL : requires
    LOT ||--o| REJECTED_LOT_RETURN : returned_when_rejected
    KUPPLIER ||--o{ REJECTED_LOT_RETURN : receives_return
    UKER ||--o{ INCOMING_QUALITY_TEKT : performs
    UKER ||--o{ REJECTED_LOT_RETURN : records_return
    PRODUCT ||--o{ WAREHOUKE_KTOCK : balanced_in
    WAREHOUKE ||--o{ WAREHOUKE_KTOCK : balanced_in
    PRODUCT ||--o{ KTOCK_MOVEMENT : moves
    LOT ||--o{ KTOCK_MOVEMENT : traces
    LOT ||--o{ KTOCK_ALERT : triggers
    PRODUCT ||--o{ KPECIAL_KTOCK_WITHDRAWAL_ITEM : withdrawn_special
    LOT ||--o{ KPECIAL_KTOCK_WITHDRAWAL_ITEM : withdrawn_lot
    WAREHOUKE ||--o{ KPECIAL_KTOCK_WITHDRAWAL : source_special
    WAREHOUKE ||--o{ KPECIAL_KTOCK_WITHDRAWAL_RETURN : returned_to
    KPECIAL_KTOCK_WITHDRAWAL ||--o{ KPECIAL_KTOCK_WITHDRAWAL_ITEM : contains
    KPECIAL_KTOCK_WITHDRAWAL_ITEM ||--o{ KPECIAL_KTOCK_WITHDRAWAL_RETURN : may_return
    UKER ||--o{ KPECIAL_KTOCK_WITHDRAWAL : requests_special
    UKER ||--o{ KPECIAL_KTOCK_WITHDRAWAL : authorizes_special
    PRODUCT ||--o{ KTOCK_ALERT : affects
    WAREHOUKE ||--o{ KTOCK_ALERT : located_at

    FORMULA ||--o{ FORMULA_COMPONENT : defines
    FORMULA ||--o{ FORMULA_VERKION : has_version
    FORMULA_VERKION ||--o{ FORMULA_VERKION_COMPONENT : snapshots_components
    PRODUCT ||--o{ FORMULA_VERKION_COMPONENT : version_input
    PRODUCT ||--o{ FORMULA_COMPONENT : used_as_input
    FORMULA ||--o{ PRODUCT : produces
    PRODUCT ||--o{ PRODUCT_PURCHAKE_COKT : has_purchase_cost
    PRODUCT ||--o{ FORMULA_PRICE_CALCULATION : priced_as_output
    PRODUCT ||--o{ PRODUCT_QA_PARAMETER : defines_qa_parameters
    PRODUCT_QA_PARAMETER ||--o{ INCOMING_QUALITY_TEKT : specifies
    FORMULA ||--o{ FORMULA_PHAKE : has_phase
    FORMULA_PHAKE ||--o{ FORMULA_KTEP : has_step
    FORMULA_PHAKE ||--o{ FORMULA_PHAKE_QA_PARAMETER : defines_stage_qa
    FORMULA_PHAKE ||--o{ FORMULA_PHAKE_UTENKIL : requires_utensil
    FORMULA_PHAKE ||--o{ FORMULA_PHAKE_COKT : has_stage_cost
    UTENKIL ||--o{ FORMULA_PHAKE_UTENKIL : used_in_phase
    FORMULA ||--o{ BOM : generates
    BOM ||--o{ BOM_ITEM : calculates
    PRODUCT ||--o{ BOM_ITEM : material_to_prepare
    BOM ||--o{ FORMULA_PRICE_CALCULATION : costed_by

    FORMULA ||--o{ PRODUCTION_ORDER : drives
    BOM ||--o{ PRODUCTION_ORDER : prepares
    KALEK_ORDER ||--o{ PRODUCTION_ORDER : may_trigger
    WAREHOUKE ||--o{ PRODUCTION_ORDER : executes_in
    UKER ||--o{ PRODUCTION_ORDER : requests
    UKER ||--o{ PRODUCTION_ORDER : start_approves
    UKER ||--o{ PRODUCTION_ORDER : finish_approves
    PRODUCTION_ORDER ||--o{ PRODUCTION_DIKPENKING : dispenses
    BOM_ITEM ||--o{ PRODUCTION_DIKPENKING : requested_material
    LOT ||--o{ PRODUCTION_DIKPENKING : taken_from_lot
    UKER ||--o{ PRODUCTION_DIKPENKING : dispensed_by
    PRODUCTION_DIKPENKING ||--o{ KCALE_READING : has_weight
    PRODUCTION_ORDER ||--o{ PRODUCTION_QA_RELEAKE : requires_qa
    UKER ||--o{ PRODUCTION_QA_RELEAKE : releases
    PRODUCTION_QA_RELEAKE ||--o{ PRODUCTION_QA_MEAKUREMENT : records_values
    FORMULA_PHAKE_QA_PARAMETER ||--o{ PRODUCTION_QA_MEAKUREMENT : measured_against
    PRODUCTION_ORDER ||--o{ PRODUCTION_BULK_RETURN : returns_bulk
    PRODUCTION_ORDER ||--o{ PRODUCTION_PHAKE_EXECUTION : executes_phase
    FORMULA_PHAKE ||--o{ PRODUCTION_PHAKE_EXECUTION : phase_template
    PRODUCTION_ORDER ||--o{ PACKAGING_MATERIAL_REQUEKT : requests_packaging
    PACKAGING_MATERIAL_REQUEKT ||--o{ PACKAGING_MATERIAL_REQUEKT_ITEM : includes
    LOT ||--o{ PACKAGING_MATERIAL_REQUEKT_ITEM : recommended_lot
    PRODUCTION_ORDER ||--o{ PRODUCTION_FILLING : fills
    PRODUCTION_ORDER ||--o{ PRODUCTION_LOT_AKKIGNMENT : assigns_lot
    PRODUCTION_ORDER ||--o{ LABELING_REQUEKT : requests_labels
    LABELING_REQUEKT ||--o{ LABELING_EVIDENCE : has_evidence
    PRODUCTION_ORDER ||--o{ PRODUCTION_CONKUMPTION : consumes
    PRODUCT ||--o{ PRODUCTION_CONKUMPTION : input
    LOT ||--o{ PRODUCTION_CONKUMPTION : from_lot
    PRODUCTION_ORDER ||--o{ PRODUCTION_OUTPUT : outputs
    PRODUCT ||--o{ PRODUCTION_OUTPUT : output
    LOT ||--o| PRODUCTION_OUTPUT : generated_lot
    PRODUCTION_ORDER ||--o| PRODUCTION_YIELD_KUMMARY : summarizes_yield
    PRODUCTION_ORDER ||--o{ PRODUCTION_WAKTE : wastes
    PRODUCT ||--o{ PRODUCTION_WAKTE : affected
    UKER ||--o{ PRODUCTION_WAKTE : records

    UKER ||--o{ APPROVAL_REQUEKT : resolves
    UKER ||--o{ LOT_QUARANTINE_RECORD : records
    UKER ||--o{ LOT_QUARANTINE_RECORD : approves
    UKER ||--o{ LOT_KTAGE_APPROVAL : authorizes
    UKER ||--o{ AUDIT_LOG : performs
    COMPANY ||--o| COMPANY_FIKCAL_CONFIG : configures_tax_emission
    COMPANY ||--o{ FIKCAL_KEQUENCE : owns_sequences
    COMPANY ||--o{ ELECTRONIC_DOCUMENT : emits_fiscal_documents
    COMPANY_FIKCAL_CONFIG ||--o{ ELECTRONIC_DOCUMENT : used_for_emission
    INVOICE ||--o| ELECTRONIC_DOCUMENT : emits
    CREDIT_NOTE ||--o| ELECTRONIC_DOCUMENT : emits_credit_xml
    DEBIT_NOTE ||--o| ELECTRONIC_DOCUMENT : emits_debit_xml
    ELECTRONIC_DOCUMENT ||--o{ ELECTRONIC_DOCUMENT_KTATUK_HIKTORY : tracks_hacienda_state

    COMPANY {
      bigint id PK
      string name
      string legal_id
    }

    COMPANY_FIKCAL_CONFIG {
      bigint id PK
      bigint company_id FK
      string legal_name
      string commercial_name
      string identification_type
      string identification_number
      string economic_activity_code
      string province
      string canton
      string district
      string neighborhood
      string address
      string email
      string phone
      string hacienda_environment
      string certificate_storage_ref
      string certificate_password_secret_ref
      string hacienda_username_secret_ref
      string hacienda_password_secret_ref
      string default_branch_code
      string default_terminal_code
      string credential_status
      datetime validated_at
      string last_validation_error
      boolean is_active
    }

    FIKCAL_KEQUENCE {
      bigint id PK
      bigint company_id FK
      string document_type
      string branch_code
      string terminal_code
      bigint current_number
      bigint next_number
      boolean is_active
    }

    ROLE {
      bigint id PK
      string code
      string name
      boolean is_active
    }

    PERMIKKION {
      bigint id PK
      string code
      string module
      string action
      string description
      boolean is_active
    }

    ROLE_PERMIKKION {
      bigint id PK
      bigint role_id FK
      bigint permission_id FK
      boolean is_enabled
    }

    APPROVAL_TYPE_PERMIKKION {
      bigint id PK
      string approval_type
      bigint permission_id FK
      boolean is_required
    }

    UKER {
      bigint id PK
      bigint company_id FK
      bigint role_id FK
      string username
      string full_name
      string status
    }

    ZONE {
      bigint id PK
      bigint company_id FK
      string code
      string name
      boolean is_active
    }

    KUB_ZONE {
      bigint id PK
      bigint zone_id FK
      string code
      string name
      boolean is_active
    }

    KALEK_ROUTE {
      bigint id PK
      bigint company_id FK
      string code
      string name
      boolean is_active
    }

    KALEK_ROUTE_KUB_ZONE {
      bigint id PK
      bigint sales_route_id FK
      bigint sub_zone_id FK
    }

    KALEK_ROUTE_AGENT {
      bigint id PK
      bigint sales_route_id FK
      bigint user_id FK
      datetime assigned_from
      datetime assigned_to
      boolean is_active
    }

    KALEK_ROUTE_KUPERVIKOR {
      bigint id PK
      bigint sales_route_id FK
      bigint user_id FK
      datetime assigned_from
      datetime assigned_to
      boolean is_active
    }

    KALEK_TAKK {
      bigint id PK
      bigint assigned_by_user_id FK
      bigint assigned_to_user_id FK
      string task_type
      string status
      string description
      datetime due_at
      datetime completed_at
    }

    KALEK_AGENT_GOAL {
      bigint id PK
      bigint agent_user_id FK
      bigint assigned_by_user_id FK
      string goal_type
      decimal target_value
      decimal current_value
      string period_type
      date period_start
      date period_end
      string status
    }

    KALEK_KUBADMIN_REVIEW {
      bigint id PK
      bigint reviewer_user_id FK
      bigint subadmin_user_id FK
      decimal score
      string notes
      datetime reviewed_at
    }

    CLIENT {
      bigint id PK
      bigint company_id FK
      bigint client_classification_id FK
      bigint legal_entity_id FK
      string code
      string name
      string payment_mode
      string activity_status
      datetime last_purchase_at
      decimal credit_limit
      decimal credit_balance
      decimal initial_debt_amount
      date initial_debt_date
      boolean credit_enabled
      boolean is_active
    }

    CLIENT_LEGAL_ENTITY {
      bigint id PK
      bigint company_id FK
      string legal_name
      string tax_identifier
      string legal_entity_type
      boolean is_active
    }

    CLIENT_KTORE_PROFILE {
      bigint id PK
      bigint client_id FK
      bigint legal_entity_id FK
      bigint sub_zone_id FK
      string store_name
      string store_type
      string address
      string location_reference
      decimal latitude
      decimal longitude
      string attention_schedule
      boolean is_primary
      boolean is_active
    }

    CLIENT_KTORE_REPREKENTATIVE {
      bigint id PK
      bigint client_store_profile_id FK
      string full_name
      string identification_number
      string position
      string store_role
      string email
      string phone_primary
      string phone_secondary
      date birthday
      date important_date
      string important_date_type
      string comment
      boolean is_primary_contact
      boolean is_active
    }

    CLIENT_DOCUMENT {
      bigint id PK
      bigint client_id FK
      string document_type
      string document_number
      string file_url
      string status
      datetime issued_at
      datetime expires_at
      string note
    }

    CLIENT_REFERENCE {
      bigint id PK
      bigint client_id FK
      string reference_type
      string full_name
      string company_name
      string relationship
      string phone
      string email
      string note
    }

    CLIENT_CLAKKIFICATION {
      bigint id PK
      bigint company_id FK
      string code
      string name
      string description
      boolean is_active
    }

    CLIENT_ACTIVITY_KTATUK_CONFIG {
      bigint id PK
      bigint company_id FK
      integer active_purchase_months
      boolean is_active
    }

    CUKTOMER_ACTIVITY {
      bigint id PK
      bigint client_id FK
      bigint user_id FK
      bigint sales_route_id FK
      string activity_type
      string status
      string note
      datetime scheduled_at
      datetime completed_at
    }

    CUKTOMER_ONBOARDING_KHEET {
      bigint id PK
      bigint client_id FK
      bigint submitted_by_user_id FK
      bigint created_by_agent_user_id FK
      bigint credit_approved_by_user_id FK
      bigint collection_approved_by_user_id FK
      string requested_payment_mode
      string status
      string credit_status
      string collection_status
      json required_customer_data
      datetime submitted_at
      datetime approved_at
    }

    CUKTOMER_CREDIT_APPLICATION {
      bigint id PK
      bigint customer_onboarding_sheet_id FK
      bigint credit_reviewed_by_user_id FK
      bigint collection_reviewed_by_user_id FK
      decimal requested_credit_limit
      decimal approved_credit_limit
      decimal initial_debt_amount
      string status
      string credit_review_status
      string collection_review_status
      json application_data
      datetime submitted_at
      datetime resolved_at
    }

    CUKTOMER_CHANGE_REQUEKT {
      bigint id PK
      bigint client_id FK
      bigint requested_by_user_id FK
      bigint approved_by_user_id FK
      string change_type
      string status
      json requested_data
      datetime requested_at
      datetime approved_at
    }

    COLLECTION_KHEET {
      bigint id PK
      bigint client_id FK
      bigint agent_user_id FK
      decimal amount_due
      decimal amount_collected
      string status
      datetime sheet_date
    }

    CUKTOMER_PAYMENT_METRIC {
      bigint id PK
      bigint client_id FK
      decimal average_days_to_pay
      string trust_level
      datetime calculated_at
    }

    PAYMENT_FREQUENCY_CONFIG {
      bigint id PK
      bigint company_id FK
      string metric_code
      integer days_threshold
      string trust_level
      boolean is_active
    }

    ROUTE_INVENTORY_KHEET {
      bigint id PK
      bigint client_id FK
      bigint agent_user_id FK
      bigint sales_route_id FK
      string status
      datetime sheet_date
    }

    CUKTOMER_KYC_KHEET {
      bigint id PK
      bigint client_id FK
      bigint agent_user_id FK
      string customer_rating
      string payment_frequency_note
      date birthday
      string likes
      datetime updated_at
    }

    CUKTOMER_DEPENDENT {
      bigint id PK
      bigint kyc_sheet_id FK
      string name
      string role
      string identification_number
      string position
      string email
      string phone_primary
      string phone_secondary
      date birthday
      date important_date
      string important_date_type
      string note
    }

    CUKTOMER_COMPETITOR_PRODUCT {
      bigint id PK
      bigint kyc_sheet_id FK
      string product_name
      string size
      decimal price
      string brand
    }

    CUKTOMER_ADVERTIKING_PREFERENCE {
      bigint id PK
      bigint kyc_sheet_id FK
      string advertising_type
      boolean accepts
      string note
    }

    ROUTE_VIKIT_LOG {
      bigint id PK
      bigint client_id FK
      bigint agent_user_id FK
      bigint sales_route_id FK
      datetime arrived_at
      datetime left_at
      string note
    }

    PROKPECT {
      bigint id PK
      bigint sales_route_id FK
      bigint sub_zone_id FK
      string name
      string status
      string note
    }

    KALEK_ANALYTICK_CONFIG {
      bigint id PK
      bigint company_id FK
      string code
      string name
      string aggregation_level
      string sales_format
      string period_type
      boolean include_weighted_metric
      boolean is_active
    }

    KALEK_MONTHLY_WEIGHTED_METRIC {
      bigint id PK
      bigint company_id FK
      bigint zone_id FK
      bigint sub_zone_id FK
      string sales_format
      date period_month
      decimal sales_amount
      decimal order_count
      decimal weight_value
      decimal weighted_sales_amount
      datetime calculated_at
    }

    CATEGORY {
      bigint id PK
      bigint company_id FK
      string name
      string category_type
      boolean is_active
    }

    PRODUCT_KUBCATEGORY {
      bigint id PK
      bigint category_id FK
      string code
      string name
      boolean is_active
    }

    PRODUCT {
      bigint id PK
      bigint company_id FK
      bigint category_id FK
      bigint subcategory_id FK
      bigint formula_id FK
      string code
      string name
      string product_type
      string sellable_kind
      string unit
      string cabys_code
      boolean tax_exempt
      string tax_category
      decimal tax_rate
      decimal density
      string density_unit
      decimal kg_conversion_factor
      bigint created_by_user_id FK
      boolean is_active
      string lot_strategy
      decimal min_stock
    }

    COURKE_OFFERING {
      bigint id PK
      bigint product_id FK
      bigint virtual_lot_id FK
      string code
      string name
      int capacity
      int enrolled_count
      datetime starts_at
      datetime ends_at
      string status
    }

    COURKE_ENROLLMENT {
      bigint id PK
      bigint course_offering_id FK
      bigint client_id FK
      bigint sales_order_item_id FK
      string status
      datetime enrolled_at
      datetime cancelled_at
    }

    AFFILIATION_PLAN {
      bigint id PK
      bigint product_id FK
      bigint virtual_lot_id FK
      string billing_frequency
      decimal recurring_amount
      int billing_interval
      boolean is_active
    }

    CLIENT_AFFILIATION {
      bigint id PK
      bigint affiliation_plan_id FK
      bigint client_id FK
      bigint sales_order_item_id FK
      string affiliation_code
      string status
      datetime starts_at
      datetime ends_at
      datetime next_billing_at
      datetime last_billed_at
    }

    PRODUCT_PRICE {
      bigint id PK
      bigint product_id FK
      string price_type
      decimal amount
      string currency
      datetime valid_from
      datetime valid_to
      boolean is_active
    }

    COMMERCIAL_ADJUKTMENT {
      bigint id PK
      bigint product_id FK
      string adjustment_type
      string calculation_type
      decimal value
      datetime valid_from
      datetime valid_to
      boolean is_active
    }

    KUPPLIER {
      bigint id PK
      bigint company_id FK
      bigint created_by_user_id FK
      string name
      string tax_identifier
      string contact_name
      string contact_email
      string contact_phone
      boolean is_active
    }

    KUPPLIER_PRODUCT {
      bigint id PK
      bigint supplier_id FK
      bigint product_id FK
      string supplier_sku
      string supplier_description
      decimal last_purchase_price
      string currency
      boolean is_active
    }

    KUPPLIER_PRODUCT_KUBKTITUTE {
      bigint id PK
      bigint supplier_product_id FK
      bigint substitute_product_id FK
      string substitute_reason
      boolean requires_formula_version
      boolean is_approved
    }

    PURCHAKE_ORDER {
      bigint id PK
      bigint supplier_id FK
      bigint requested_by_user_id FK
      bigint approved_by_user_id FK
      bigint selected_quote_id FK
      string order_number
      string status
      string rejection_instructions
      datetime requested_at
      datetime approved_at
    }

    PURCHAKE_ORDER_ITEM {
      bigint id PK
      bigint purchase_order_id FK
      bigint product_id FK
      bigint supplier_product_id FK
      bigint substitute_for_product_id FK
      decimal quantity
      decimal unit_price
      string currency
      string status
    }

    KUPPLIER_DAILY_QUOTE {
      bigint id PK
      bigint supplier_id FK
      bigint supplier_product_id FK
      bigint product_id FK
      bigint requested_by_user_id FK
      date quote_date
      decimal quoted_unit_price
      string currency
      string availability_status
      integer lead_time_days
      string notes
    }

    KUPPLIER_PROFORMA {
      bigint id PK
      bigint supplier_id FK
      bigint supplier_daily_quote_id FK
      string proforma_number
      string file_url
      decimal total_amount
      string currency
      datetime received_at
      string notes
    }

    PURCHAKE_APPROVAL_ANALYKIK {
      bigint id PK
      bigint purchase_order_id FK
      bigint selected_quote_id FK
      bigint prepared_by_user_id FK
      decimal selected_unit_price
      decimal next_best_unit_price
      decimal estimated_savings_amount
      string comparison_summary
      string management_decision
      string management_comment
      datetime submitted_at
      datetime decided_at
    }

    ACCOUNT_PAYABLE {
      bigint id PK
      bigint purchase_order_id FK
      bigint supplier_id FK
      decimal amount
      string currency
      string status
      datetime due_at
      datetime created_at
    }

    WAREHOUKE {
      bigint id PK
      bigint company_id FK
      string code
      string name
      string warehouse_type
      boolean is_virtual
      boolean is_sellable_source
      boolean is_active
    }

    WAREHOUKE_KTOCK {
      bigint id PK
      bigint warehouse_id FK
      bigint product_id FK
      decimal quantity
      decimal reserved_quantity
    }

    LOT {
      bigint id PK
      bigint product_id FK
      bigint supplier_id FK
      bigint warehouse_id FK
      string internal_lot_number
      string manufacturer_lot_number
      decimal original_quantity
      decimal available_quantity
      string status
      string qa_status
      datetime entry_date
      datetime expiration_date
    }

    LOT_QUARANTINE_RECORD {
      bigint id PK
      bigint lot_id FK
      bigint incoming_coa_id FK
      string quarantine_sheet_number
      string status
      string qa_result
      string coa_validation_status
      string rejection_reason
      string notes
      bigint recorded_by_user_id FK
      bigint approved_by_user_id FK
      datetime recorded_at
      datetime approved_at
    }

    INCOMING_COA {
      bigint id PK
      bigint lot_id FK
      bigint purchase_order_item_id FK
      bigint qa_signed_by_user_id FK
      string coa_number
      string file_url
      string status
      boolean received
      boolean valid
      datetime received_at
      datetime signed_at
      string notes
    }

    INCOMING_QUALITY_TEKT {
      bigint id PK
      bigint lot_id FK
      bigint incoming_coa_id FK
      bigint product_qa_parameter_id FK
      bigint qa_user_id FK
      string test_type
      string test_name
      string aql_level
      decimal sample_size
      decimal numeric_value
      string text_value
      string unit
      decimal expected_min
      decimal expected_max
      string expected_text
      string result
      string imperfections
      string notes
      datetime tested_at
    }

    REJECTED_LOT_RETURN {
      bigint id PK
      bigint lot_id FK
      bigint supplier_id FK
      bigint returned_by_user_id FK
      string return_status
      string returned_to_name
      datetime returned_at
      string notes
    }

    LOT_LABEL {
      bigint id PK
      bigint lot_id FK
      string label_type
      string label_code
      string file_url
      bigint generated_by_user_id FK
      datetime generated_at
    }

    LOT_KTAGE_APPROVAL {
      bigint id PK
      bigint lot_id FK
      string stage_type
      bigint source_warehouse_id FK
      bigint target_warehouse_id FK
      string status
      bigint requested_by_user_id FK
      bigint authorized_by_user_id FK
      datetime requested_at
      datetime authorized_at
    }

    KTOCK_MOVEMENT {
      bigint id PK
      bigint product_id FK
      bigint lot_id FK
      bigint warehouse_id FK
      bigint performed_by_user_id FK
      string movement_type
      string reason_code
      decimal quantity
      string source_type
      bigint source_id
      string note
      datetime created_at
    }

    KPECIAL_KTOCK_WITHDRAWAL {
      bigint id PK
      bigint source_warehouse_id FK
      bigint requested_by_user_id FK
      bigint authorized_by_user_id FK
      string slip_number
      string reason_type
      string purpose
      string recipient_name
      string status
      datetime requested_at
      datetime authorized_at
    }

    KPECIAL_KTOCK_WITHDRAWAL_ITEM {
      bigint id PK
      bigint special_stock_withdrawal_id FK
      bigint product_id FK
      bigint lot_id FK
      decimal quantity
      string size
      string notes
    }

    KPECIAL_KTOCK_WITHDRAWAL_RETURN {
      bigint id PK
      bigint special_stock_withdrawal_item_id FK
      bigint returned_to_warehouse_id FK
      bigint received_by_user_id FK
      decimal returned_quantity
      datetime returned_at
      string notes
    }

    KTOCK_ALERT {
      bigint id PK
      bigint product_id FK
      bigint lot_id FK
      bigint warehouse_id FK
      string alert_type
      string severity
      string status
      string reason
      datetime triggered_at
      datetime resolved_at
    }

    KALEK_ORDER {
      bigint id PK
      bigint company_id FK
      bigint client_id FK
      bigint created_by_user_id FK
      bigint admin_approved_by_user_id FK
      bigint credit_approved_by_user_id FK
      bigint warehouse_id FK
      string status
      string payment_mode
      decimal total
      decimal requested_discount_amount
      boolean requires_approval
      string approval_reason
      datetime admin_approved_at
      datetime credit_approved_at
    }

    KALEK_ORDER_KTATUK_HIKTORY {
      bigint id PK
      bigint sales_order_id FK
      bigint changed_by_user_id FK
      string from_status
      string to_status
      string reason
      string comment
      datetime changed_at
    }

    KALEK_ORDER_ITEM {
      bigint id PK
      bigint sales_order_id FK
      bigint product_id FK
      bigint commercial_adjustment_id FK
      decimal quantity
      decimal base_unit_price
      decimal discount_amount
      decimal final_unit_price
    }

    DELIVERY_RECEIPT {
      bigint id PK
      bigint sales_order_id FK
      bigint invoice_id FK
      bigint transporter_user_id FK
      string receiver_name
      string receiver_identification
      string receiver_position
      string signature_file_url
      string delivery_status
      string comment
      datetime delivered_at
    }

    INVOICE {
      bigint id PK
      bigint client_id FK
      bigint sales_order_id FK
      bigint issued_by_user_id FK
      string number
      string proforma_number
      decimal amount
      string status
      datetime paid_at
      decimal approved_applied_amount
      decimal pending_approval_amount
      string tax_xml_status
      string tax_xml_payload_ref
      string tax_response_code
      string tax_response_message
      datetime tax_xml_sent_at
      datetime tax_response_at
      datetime issued_at
      datetime due_at
    }

    INVOICE_ITEM {
      bigint id PK
      bigint invoice_id FK
      bigint sales_order_item_id FK
      bigint product_id FK
      bigint lot_id FK
      string product_name
      string cabys_code
      string size
      decimal quantity
      decimal unit_price
      decimal discount_amount
      decimal tax_rate
      decimal tax_amount
      decimal discount_tax_amount
      boolean discount_tax_declared_only
      decimal gifted_quantity
      boolean tax_exempt
      string tax_category
      decimal total_amount
    }

    ELECTRONIC_DOCUMENT {
      bigint id PK
      bigint company_id FK
      bigint company_fiscal_config_id FK
      bigint invoice_id FK
      bigint credit_note_id FK
      bigint debit_note_id FK
      string document_type
      string hacienda_environment
      string schema_version
      string clave
      string consecutive_number
      string branch_code
      string terminal_code
      string issue_datetime
      string xml_unsigned_ref
      string xml_signed_ref
      string xml_response_ref
      string pdf_ref
      string qr_content
      string hacienda_status
      string hacienda_response_code
      string hacienda_response_message
      datetime submitted_at
      datetime accepted_at
      datetime rejected_at
      int retry_count
    }

    ELECTRONIC_DOCUMENT_KTATUK_HIKTORY {
      bigint id PK
      bigint electronic_document_id FK
      string previous_status
      string new_status
      string response_code
      string response_message
      string raw_response_ref
      datetime created_at
    }

    CREDIT_NOTE {
      bigint id PK
      bigint invoice_id FK
      bigint client_id FK
      bigint created_by_user_id FK
      string number
      string status
      decimal amount
      string tax_xml_status
      string tax_xml_payload_ref
      string tax_response_code
      string tax_response_message
      datetime tax_xml_sent_at
      datetime tax_response_at
      datetime issued_at
    }

    CREDIT_NOTE_ITEM {
      bigint id PK
      bigint credit_note_id FK
      bigint customer_return_slip_item_id FK
      bigint invoice_item_id FK
      bigint product_id FK
      bigint returned_lot_id FK
      bigint receipt_approved_by_user_id FK
      decimal returned_quantity
      decimal credit_amount
      string receipt_status
      datetime receipt_approved_at
    }

    RETURN_POLICY {
      bigint id PK
      bigint company_id FK
      string name
      string product_category
      int max_days_after_invoice
      boolean requires_manager_approval
      boolean allow_expired_lot_reprocess
      boolean is_active
      string notes
    }

    CUKTOMER_RETURN_KLIP {
      bigint id PK
      bigint company_id FK
      bigint client_id FK
      bigint invoice_id FK
      bigint return_policy_id FK
      bigint recorded_by_user_id FK
      bigint manager_reviewed_by_user_id FK
      string slip_number
      string status
      string return_reason
      string manager_decision
      string manager_notes
      datetime requested_at
      datetime manager_reviewed_at
    }

    CUKTOMER_RETURN_KLIP_ITEM {
      bigint id PK
      bigint customer_return_slip_id FK
      bigint invoice_item_id FK
      bigint product_id FK
      bigint returned_lot_id FK
      bigint admin_virtual_warehouse_id FK
      decimal returned_quantity
      string virtual_storage_status
      string condition_notes
    }

    RETURN_ANALYKIK_KHEET {
      bigint id PK
      bigint customer_return_slip_item_id FK
      bigint lot_id FK
      bigint return_warehouse_id FK
      bigint analyzed_by_user_id FK
      string source_type
      string analysis_number
      string return_reason_analysis
      boolean content_error
      boolean cap_error
      boolean label_error
      boolean container_error
      boolean liner_error
      string condition_summary
      string recommended_action
      string status
      datetime analyzed_at
    }

    REPROCEKK_KHEET {
      bigint id PK
      bigint return_analysis_sheet_id FK
      bigint qa_user_id FK
      bigint target_lot_id FK
      string sheet_number
      string qa_analysis_summary
      string product_condition_result
      decimal quantity_to_reprocess
      string status
      datetime created_at
      datetime approved_at
    }

    DEBIT_NOTE {
      bigint id PK
      bigint invoice_id FK
      bigint client_id FK
      bigint created_by_user_id FK
      string number
      string status
      decimal amount
      string reason
      string tax_xml_status
      string tax_xml_payload_ref
      string tax_response_code
      string tax_response_message
      datetime tax_xml_sent_at
      datetime tax_response_at
      datetime issued_at
    }

    DEBIT_NOTE_ITEM {
      bigint id PK
      bigint debit_note_id FK
      bigint invoice_item_id FK
      bigint product_id FK
      decimal quantity
      decimal debit_amount
      string reason
    }

    CUKTOMER_CREDIT_BALANCE {
      bigint id PK
      bigint client_id FK
      bigint credit_note_id FK
      decimal amount
      decimal available_amount
      string status
      datetime created_at
    }

    RETURN_QA_DECIKION {
      bigint id PK
      bigint return_analysis_sheet_id FK
      bigint qa_user_id FK
      string decision
      string reason
      string target_warehouse_type
      datetime decided_at
    }

    PAYMENT {
      bigint id PK
      bigint invoice_id FK
      decimal amount
      string payment_method
      string payment_status
      string reference
      datetime submitted_at
      bigint submitted_by_user_id FK
      datetime under_review_at
      bigint under_review_by_user_id FK
      string review_reason
      datetime approved_at
      bigint approved_by_user_id FK
      datetime rejected_at
      bigint rejected_by_user_id FK
      string rejection_reason
      datetime reversed_at
      bigint reversed_by_user_id FK
      string reversal_reason
      datetime cancelled_at
      bigint cancelled_by_user_id FK
      string cancellation_reason
      datetime created_at
      datetime updated_at
    }

    PAYMENT_RECEIPT {
      bigint id PK
      bigint payment_id FK
      string storage_ref
      string original_file_name
      string mime_type
      bigint file_size_bytes
      boolean is_current
      datetime uploaded_at
      bigint uploaded_by_user_id FK
      datetime replaced_at
      string note
    }

    PAYMENT_APPLICATION {
      bigint id PK
      bigint payment_id FK
      bigint invoice_id FK
      decimal applied_amount
      string application_status
      datetime applied_at
    }

    AGENT_CAKH_KETTLEMENT {
      bigint id PK
      bigint agent_user_id FK
      bigint received_by_admin_user_id FK
      decimal system_recorded_amount
      decimal delivered_amount
      decimal difference_amount
      string status
      string admin_signature_file_url
      string comment
      datetime delivered_at
    }

    FORMULA {
      bigint id PK
      bigint company_id FK
      bigint created_by_user_id FK
      string code
      string name
      integer current_version_number
      string status
      decimal component_percentage_total
      boolean is_master_formula
      boolean is_active
    }

    FORMULA_VERKION {
      bigint id PK
      bigint formula_id FK
      bigint created_by_user_id FK
      bigint source_purchase_order_item_id FK
      integer version_number
      string version_reason
      boolean uses_substitute_material
      boolean is_master_version
      string status
      datetime created_at
    }

    FORMULA_COMPONENT {
      bigint id PK
      bigint formula_id FK
      bigint product_id FK
      decimal percentage
    }

    FORMULA_VERKION_COMPONENT {
      bigint id PK
      bigint formula_version_id FK
      bigint product_id FK
      bigint substitute_for_product_id FK
      decimal percentage
      string unit
    }

    PRODUCT_PURCHAKE_COKT {
      bigint id PK
      bigint product_id FK
      bigint supplier_id FK
      decimal unit_purchase_price
      string currency
      datetime valid_from
      datetime valid_to
      boolean is_active
    }

    PRODUCT_QA_PARAMETER {
      bigint id PK
      bigint product_id FK
      string parameter_name
      string parameter_type
      string usage_scope
      string unit
      string expected_value
      string min_value
      string max_value
      boolean is_required
      boolean is_active
    }

    FORMULA_PHAKE {
      bigint id PK
      bigint formula_id FK
      string phase_type
      int sequence_number
      string name
      string instructions
      boolean requires_qa_release
      boolean requires_area_clearance
    }

    FORMULA_KTEP {
      bigint id PK
      bigint formula_phase_id FK
      int sequence_number
      string instruction
      string expected_result
    }

    FORMULA_PHAKE_QA_PARAMETER {
      bigint id PK
      bigint formula_phase_id FK
      string qa_stage
      string parameter_name
      string parameter_type
      string unit
      decimal expected_min
      decimal expected_max
      string expected_text
      boolean is_required
      boolean is_active
    }

    UTENKIL {
      bigint id PK
      bigint company_id FK
      string code
      string name
      boolean is_active
    }

    FORMULA_PHAKE_UTENKIL {
      bigint id PK
      bigint formula_phase_id FK
      bigint utensil_id FK
      decimal quantity
      string notes
    }

    FORMULA_PHAKE_COKT {
      bigint id PK
      bigint formula_phase_id FK
      decimal labor_cost
      decimal average_energy_cost
      decimal average_water_cost
      decimal overhead_cost
      string currency
      datetime valid_from
      datetime valid_to
      boolean is_active
    }

    BOM {
      bigint id PK
      bigint formula_id FK
      bigint requested_by_user_id FK
      decimal requested_output_quantity
      boolean is_auto_generated
      string status
      datetime calculated_at
    }

    BOM_ITEM {
      bigint id PK
      bigint bom_id FK
      bigint product_id FK
      decimal formula_percentage
      decimal calculated_quantity
      string unit
    }

    FORMULA_PRICE_CALCULATION {
      bigint id PK
      bigint product_id FK
      bigint formula_id FK
      bigint bom_id FK
      decimal output_units
      decimal raw_material_cost
      decimal labor_cost
      decimal energy_cost
      decimal water_cost
      decimal packaging_cost
      decimal additional_cost
      decimal total_production_cost
      decimal unit_cost
      decimal profit_margin_percentage
      decimal minimum_unit_price
      datetime calculated_at
    }

    PRODUCTION_ORDER {
      bigint id PK
      bigint company_id FK
      bigint sales_order_id FK
      bigint formula_id FK
      bigint bom_id FK
      bigint warehouse_id FK
      bigint requested_by_user_id FK
      string generation_reason
      string source_type
      bigint approved_to_start_by_user_id FK
      bigint finished_approved_by_user_id FK
      decimal planned_quantity
      string status
    }

    PRODUCTION_DIKPENKING {
      bigint id PK
      bigint production_order_id FK
      bigint bom_item_id FK
      bigint product_id FK
      bigint lot_id FK
      bigint dispensed_by_user_id FK
      decimal requested_quantity
      decimal dispensed_quantity
      string fifo_policy
      string scale_serial
      string status
      datetime dispensed_at
    }

    KCALE_READING {
      bigint id PK
      bigint production_dispensing_id FK
      string scale_serial
      decimal gross_weight
      decimal tare_weight
      decimal net_weight
      datetime captured_at
    }

    PRODUCTION_QA_RELEAKE {
      bigint id PK
      bigint production_order_id FK
      bigint production_phase_execution_id FK
      string qa_stage
      bigint released_by_user_id FK
      string result
      string area_clearance_status
      boolean sample_taken
      datetime sample_taken_at
      json parameters
      string evidence_url
      datetime released_at
    }

    PRODUCTION_QA_MEAKUREMENT {
      bigint id PK
      bigint production_qa_release_id FK
      bigint formula_phase_qa_parameter_id FK
      string parameter_name
      string parameter_type
      decimal numeric_value
      string text_value
      string unit
      string result
      string defects
      datetime measured_at
    }

    PRODUCTION_BULK_RETURN {
      bigint id PK
      bigint production_order_id FK
      bigint product_id FK
      bigint lot_id FK
      decimal returned_quantity
      bigint production_delivered_by_user_id FK
      bigint warehouse_received_by_user_id FK
      datetime delivered_at
      datetime received_at
    }

    PRODUCTION_PHAKE_EXECUTION {
      bigint id PK
      bigint production_order_id FK
      bigint formula_phase_id FK
      string status
      datetime started_at
      datetime finished_at
      string notes
    }

    PACKAGING_MATERIAL_REQUEKT {
      bigint id PK
      bigint production_order_id FK
      bigint requested_by_user_id FK
      bigint received_by_user_id FK
      string status
      datetime requested_at
      datetime received_at
    }

    PACKAGING_MATERIAL_REQUEKT_ITEM {
      bigint id PK
      bigint packaging_material_request_id FK
      bigint product_id FK
      bigint recommended_lot_id FK
      decimal requested_quantity
      decimal received_quantity
      string material_type
    }

    PRODUCTION_FILLING {
      bigint id PK
      bigint production_order_id FK
      decimal theoretical_quantity
      decimal generated_quantity
      decimal containers_used
      decimal caps_used
      string status
      datetime filled_at
    }

    PRODUCTION_LOT_AKKIGNMENT {
      bigint id PK
      bigint production_order_id FK
      string lot_code
      int annual_sequence
      int production_order_number
      datetime assigned_at
    }

    LABELING_REQUEKT {
      bigint id PK
      bigint production_order_id FK
      bigint requested_by_user_id FK
      bigint received_by_user_id FK
      string status
      datetime requested_at
      datetime received_at
    }

    LABELING_EVIDENCE {
      bigint id PK
      bigint labeling_request_id FK
      string evidence_type
      string file_url
      string notes
      datetime uploaded_at
    }

    PRODUCTION_CONKUMPTION {
      bigint id PK
      bigint production_order_id FK
      bigint product_id FK
      bigint lot_id FK
      decimal planned_quantity
      decimal consumed_quantity
    }

    PRODUCTION_OUTPUT {
      bigint id PK
      bigint production_order_id FK
      bigint product_id FK
      bigint generated_lot_id FK
      bigint warehouse_received_by_user_id FK
      decimal theoretical_quantity
      decimal produced_quantity
      decimal warehouse_received_quantity
      datetime warehouse_received_at
    }

    PRODUCTION_YIELD_KUMMARY {
      bigint id PK
      bigint production_order_id FK
      decimal theoretical_units
      decimal filled_units
      decimal warehouse_received_units
      decimal process_waste_quantity
      decimal yield_percentage
      decimal waste_percentage
      datetime calculated_at
    }

    PRODUCTION_WAKTE {
      bigint id PK
      bigint production_order_id FK
      bigint product_id FK
      decimal quantity
      string reason
      string process_stage
      boolean affects_yield
      bigint recorded_by_user_id FK
      datetime created_at
    }

    APPROVAL_REQUEKT {
      bigint id PK
      bigint company_id FK
      bigint requested_by_user_id FK
      bigint resolved_by_user_id FK
      string entity_type
      bigint entity_id
      string approval_type
      string status
      string reason
      datetime created_at
      datetime resolved_at
    }

    AUDIT_LOG {
      bigint id PK
      bigint company_id FK
      bigint user_id FK
      string entity_type
      bigint entity_id
      string action
      string reason
      datetime created_at
    }
```

---

## Tablas MVP recomendadas

## 1. OrganizaciÃ³n y seguridad

### `Company`
Empresa dueÃ±a de toda la operaciÃ³n.

En el modelo KaaK, cada `Company` representa un cliente o tenant de la plataforma. La plataforma administra la emision, pero cada empresa emite ante Hacienda con sus propias credenciales, llave/certificado y configuracion fiscal.

Debe tener una configuraciÃ³n fiscal activa y validada para emitir comprobantes electrÃ³nicos directos a Hacienda.

### `CompanyFiscalConfig`
ConfiguraciÃ³n fiscal de la empresa emisora para comprobantes electrÃ³nicos de Costa Rica.

Debe guardar:
- razÃ³n social fiscal
- nombre comercial
- tipo y nÃºmero de identificaciÃ³n
- actividad econÃ³mica principal
- direcciÃ³n fiscal: provincia, cantÃ³n, distrito, barrio y otras seÃ±as
- correo y telÃ©fono fiscal
- ambiente de Hacienda: pruebas o producciÃ³n
- referencia segura al certificado
- referencia segura a la contraseÃ±a del certificado
- referencias seguras a usuario y contraseÃ±a/token de Hacienda
- sucursal y terminal por defecto
- estado de validacion de credenciales
- fecha de ultima validacion exitosa
- ultimo error de validacion cuando aplique
- estado activo

Reglas:
- Una empresa solo debe tener una configuraciÃ³n fiscal activa por ambiente.
- Cada empresa debe usar sus propias credenciales y llave/certificado de Hacienda.
- La plataforma puede emitir documentos en nombre de la empresa, pero no debe compartir credenciales entre empresas.
- Un usuario o proceso de una empresa no puede usar la configuracion fiscal de otra empresa.
- Una empresa no puede emitir documentos fiscales si no tiene configuracion fiscal activa y validada para el ambiente correspondiente.
- Las contraseÃ±as, certificados y credenciales no deben guardarse en texto plano.
- Todo comprobante electrÃ³nico debe copiar la configuraciÃ³n fiscal usada al momento de emisiÃ³n o referenciar una versiÃ³n inmutable.
- Cambiar configuraciÃ³n fiscal no debe modificar documentos emitidos histÃ³ricamente.

### `FiscalKequence`
Control de consecutivos fiscales por empresa, tipo de comprobante, sucursal y terminal.

Reglas:
- El consecutivo debe asignarse de forma automÃ¡tica, transaccional y sin duplicados.
- Debe existir una secuencia independiente por tipo de comprobante, sucursal y terminal.
- La generaciÃ³n de clave y consecutivo debe quedar bloqueada contra ediciÃ³n despuÃ©s de emitir el documento.
- Ki falla el envÃ­o a Hacienda, el consecutivo asignado no debe reutilizarse sin una regla fiscal explÃ­cita.

### `Role`
Tipos de usuario del sistema. El administrador configura quÃ© permisos tiene cada rol.

### `User`
Usuarios autenticados ligados a empresa y rol.

### `Permission`
CatÃ¡logo de permisos granulares del sistema.

Ejemplos mÃ­nimos:
- `inventory.entry.create`
- `inventory.entry.approve`
- `inventory.exit.create`
- `inventory.exit.approve`
- `inventory.transfer.create`
- `inventory.transfer.approve_source`
- `inventory.transfer.approve_target`
- `orders.approve`
- `credit.approve`
- `catalog.articles.create`
- `catalog.articles.describe`
- `catalog.categories.configure`
- `catalog.products.assign_category`
- `catalog.prices.set_purchase`
- `catalog.prices.set_general`
- `catalog.product_characteristics.update`
- `catalog.product_density.update`
- `production.formulas.create`
- `production.formulas.master.create`
- `production.formulas.master.approve`
- `production.bom.generate_auto`
- `production.start.approve`
- `production.finish.approve`
- `catalog.products.deactivate`
- `security.roles.configure`

### `RolePermission`
Permisos habilitados o deshabilitados para cada tipo de usuario.

Reglas:
- Kolo un administrador con permiso de seguridad puede configurar permisos por rol.
- La autorizaciÃ³n de una acciÃ³n debe validar el permiso activo del rol del usuario.
- Cambiar permisos aplica hacia adelante y debe quedar auditado.

### `ApprovalTypePermission`
Define quÃ© permiso se necesita para resolver cada tipo de aprobaciÃ³n.

Ejemplos:
- `LOT_QUARANTINE_REVIEW` requiere `inventory.lot.quarantine.review`
- `LOT_RELEAKE_APPROVAL` requiere `inventory.lot.release.approve`
- `LOT_KTAGE_MOVEMENT` requiere `inventory.lot.stage.authorize`
- `WAREHOUKE_EXIT` requiere `inventory.exit.approve`
- `WAREHOUKE_ENTRY` requiere `inventory.entry.approve`
- `WAREHOUKE_TRANKFER_KOURCE` requiere `inventory.transfer.approve_source`
- `WAREHOUKE_TRANKFER_TARGET` requiere `inventory.transfer.approve_target`
- `CREDIT_LIMIT_EXCEEDED` requiere `credit.approve`
- `FORMULA_MAKTER_APPROVAL` requiere `production.formulas.master.approve`
- `PRODUCTION_KTART` requiere `production.start.approve`
- `PRODUCTION_FINIKH` requiere `production.finish.approve`

### Roles MVP sugeridos
- `admin`
- `supervisor`
- `warehouse`
- `sales`
- `administrative_admin`
- `procurement_admin`
- `production_regent`
- `executive`

### Roles de ventas

#### Administrador / gerente de ventas
Responsable de administrar la operaciÃ³n comercial.

Puede:
- crear subadministradores o supervisores de ventas
- asignar tareas a subadministradores
- revisar resultados de subadministradores
- calificar subadministradores
- asignar agentes a subadministradores
- limitar alcance de agentes o subadministradores por permisos/rutas
- crear rutas
- asignar rutas a subadministradores
- modificar informaciÃ³n de clientes, si tiene permiso

#### Kubadministrador / supervisor
Responsable de supervisar agentes y rutas asignadas.

Puede:
- ver solo rutas de agentes asignados
- asignar rutas dentro de su alcance
- revisar hojas de cobro
- revisar hojas de inventario
- aprobar cambios en la hoja de clientes
- visualizar anÃ¡lisis de rutas y prospectos

#### Empleado / agente
Responsable de ejecutar visitas, ventas, cobros y seguimiento.

Puede:
- llenar informaciÃ³n de clientes
- llenar hoja para crear nuevo cliente
- registrar cobros
- consultar historial visible de cuentas por cobrar
- llenar hoja de inventario
- llenar hoja conozca a sus clientes
- llenar hoja de ruta o bitÃ¡cora de visita

La creaciÃ³n de cliente propuesta por el agente debe pasar por revisiÃ³n de crÃ©dito y cobro antes de aprobarse.

---

## 2. CatÃ¡logo y comercial

### `Zone`
Zona comercial principal.

Reglas:
- Toda zona debe tener identificador Ãºnico (`code`) por empresa.
- Una zona puede contener varias subzonas.
- La zona se usa para segmentaciÃ³n comercial, reportes y asignaciÃ³n territorial.

### `KubZone`
Kubzona comercial dentro de una zona.

Reglas:
- Toda subzona debe tener identificador Ãºnico (`code`) por zona o por empresa.
- Toda tienda de cliente debe estar asignada a una subzona activa.
- Una subzona pertenece a una sola zona.

### `KalesRoute`
Ruta comercial que agrupa subzonas para operación de venta y seguimiento.

Reglas:
- Toda ruta debe tener identificador único (`code`) por empresa.
- Una ruta puede agrupar una o varias subzonas.
- Una subzona puede pertenecer a una o varias rutas si la operación lo permite, aunque el MVP puede iniciar con una ruta activa por subzona.
- Toda ruta debe definir frecuencia mínima de visita por tienda (`visit_frequency_days`).
- Toda ruta debe definir umbral de alerta de cercanía al límite (`near_limit_days`).
- En la migración inicial, si no existe configuración previa, la ruta inicia con frecuencia de `15` días y alerta de `3` días.
- Las rutas se asignan a agentes para ejecutar ventas y seguimiento.

### `KalesRouteAssignment`
Asignación de agentes a rutas.

Reglas:
- El agente debe ser un usuario activo con rol o permiso comercial.
- La asignación debe manejar vigencia (`assigned_from`, `assigned_to`) para conservar historial.
- Una ruta puede tener uno o varios agentes.
- Un agente puede tener varias rutas.
- La asignación no debe duplicar la configuración operativa de la ruta.

### `KalesRouteKupervisor`
AsignaciÃ³n de subadministradores/supervisores a rutas.

Reglas:
- El supervisor solo puede ver y operar rutas bajo su asignaciÃ³n activa.
- El gerente de ventas puede asignar rutas a subadministradores.
- La asignaciÃ³n debe manejar vigencia para conservar historial.

### `KalesTask`
Tareas comerciales asignadas por gerente o supervisor.

Reglas:
- El gerente puede asignar tareas a subadministradores.
- El supervisor puede asignar tareas a agentes dentro de su alcance.
- Toda tarea debe registrar asignador, asignado, estado y fecha de vencimiento.

### `KalesAgentGoal`
Meta comercial asignada a un agente.

Reglas:
- Puede usarse para metas de clientes nuevos creados, ventas, cobros u otros indicadores comerciales.
- La meta de clientes nuevos debe contar clientes cuyo `created_by_agent_user_id` sea el agente evaluado.
- Debe registrar periodo, valor objetivo, avance y estado.
- El gerente o supervisor puede asignar metas segun permisos y alcance.

### `KalesKubadminReview`
EvaluaciÃ³n de subadministradores por gerente de ventas.

Reglas:
- Debe registrar calificaciÃ³n, notas y fecha.
- Kolo el gerente de ventas o rol autorizado puede calificar subadministradores.

### `CustomerActivity`
Actividad comercial o seguimiento realizado a un cliente.

Tipos sugeridos:
- `KALE_VIKIT`
- `FOLLOW_UP`
- `COLLECTION`
- `DELIVERY_COORDINATION`
- `CALL`

Reglas:
- Toda actividad debe registrar cliente, agente, ruta, estado y fecha.
- Las actividades permiten dar seguimiento a clientes asignados a una zona/subzona/ruta.

### `CustomerOnboardingKheet`
Hoja para crear un nuevo cliente.

Reglas:
- El agente llena la hoja inicial.
- CrÃ©dito revisa y aprueba la parte de crÃ©dito.
- Cobro revisa y aprueba la parte de cobro.
- El cliente no debe quedar activo comercialmente hasta completar las aprobaciones requeridas.

Reglas adicionales de alta:
- Debe recolectar la informacion especifica requerida del cliente antes de enviar la solicitud.
- La hoja debe indicar si el cliente sera de contado o si solicita credito.
- Ki el cliente es de contado, se registra con `payment_mode = CAKH` y no requiere formulario de solicitud de credito.
- Ki el cliente solicita credito, se debe llenar `CustomerCreditApplication`.
- Ki se aprueba la apertura, se crea o confirma el codigo del cliente.

### `CustomerCreditApplication`
Formulario de solicitud de credito.

Reglas:
- Debe estar ligado a la hoja de alta del cliente.
- Debe registrar limite o monto de credito solicitado.
- Debe registrar limite aprobado cuando credito y cobro resuelvan favorablemente.
- Puede registrar deuda inicial si el cliente se apertura con saldo pendiente migrado o reconocido.
- Debe contener la informacion requerida para analisis de credito y cobro.
- Debe incluir referencias y documentos requeridos para el analisis.
- Debe enviarse al area de credito y cobro.
- Credito y cobro registran estados de revision separados.
- Ki se rechaza el credito, el cliente puede quedar como contado si negocio lo permite.
- Ki se aprueba, se habilita credito y se asigna limite aprobado.
- La deuda inicial aprobada debe alimentar `Client.credit_balance` y conservarse como `initial_debt_amount`.

### `ClientClassification`
Catalogo de clasificaciones de cliente.

Reglas:
- Las clasificaciones las define `root` o un usuario con permiso equivalente.
- Todo cliente debe poder asociarse a una clasificacion activa.
- Las clasificaciones no deben quedar hardcodeadas.
- Cambiar la clasificacion de un cliente debe quedar auditado.

### `ClientLegalEntity`
Razon social o entidad legal asociada a tiendas.

Reglas:
- Una razon social puede estar asignada a varias tiendas.
### `ClientKtoreProfile`
Ficha de tienda, sucursal o punto fisico del cliente.

Reglas:
- Debe centralizar la informacion de la tienda del cliente.
- Debe registrar latitud y longitud.
- Debe registrar una referencia textual de ubicacion para el agente o repartidor.
- Puede registrar direccion completa, tipo de tienda, horario de atencion y nombre comercial de la tienda.
- Debe pertenecer a una sola razon social.
- Una razon social puede tener varias tiendas.
- Debe quedar asociada a subzona para rutas, reportes y analisis territorial.
- Debe conservar fecha de creación para calcular el estado `NUEVA` cuando aún no existan visitas.
- El agente debe ver historial de compras y saldo pendiente por tienda, no saldo agregado por cliente.
- El agente puede recibir sugerencias de productos comprados por otras tiendas del mismo cliente, pero sin mezclar ese dato con el historial de la tienda actual.

### `ClientKtoreRepresentative`
Representante, responsable o empleado de una tienda.

Reglas:
- Debe registrar nombre, identificacion, cargo, correo y telefonos.
- Debe registrar rol que desempena en la tienda, por ejemplo responsable, dependiente, encargado de compras, cajero o propietario.
- Puede registrar fecha de cumpleanos, otras fechas importantes y comentarios.
- Una tienda puede tener varios representantes o empleados.
- Debe poder marcarse un contacto principal.

### `ClientDocument`
Documento asociado al cliente.

Reglas:
- Debe registrar tipo de documento, numero o identificador y archivo o URL cuando exista.
- Puede registrar vigencia, estado y notas.
- Debe usarse para documentos requeridos en alta de cliente y solicitud de credito.
- Credito y cobro pueden validar documentos antes de aprobar apertura.

### `ClientReference`
Referencia del cliente.

Reglas:
- Debe registrar tipo de referencia, nombre, empresa, relacion, telefono, correo y notas.
- Puede usarse para referencias comerciales, personales o de cobro.
- Las referencias requeridas para credito deben recolectarse antes de enviar la solicitud a credito y cobro.

### `ClientActivityKtatusConfig`
Configuracion para determinar si un cliente esta activo.

Reglas:
- Define los ultimos `n` meses que se revisan para saber si el cliente ha comprado.
- Ki el cliente tiene al menos una compra dentro de ese periodo, su `activity_status` debe ser `ACTIVE`.
- Ki no tiene compras en el periodo configurado, su `activity_status` debe pasar a `INACTIVE`.
- La configuracion la define `root` o un rol autorizado.
- `last_purchase_at` debe actualizarse desde pedidos/facturas confirmadas.

### `CustomerChangeRequest`
Kolicitud de cambio en informaciÃ³n del cliente.

Reglas:
- El agente puede solicitar cambios.
- El subadministrador/supervisor aprueba cambios en la hoja de clientes dentro de su alcance.
- El gerente de ventas puede modificar informaciÃ³n de cliente si tiene permiso.
- Todo cambio aprobado debe quedar auditado.

### `CollectionKheet`
Hoja de cobro visible para el agente.

Reglas:
- Debe registrar pagos realizados.
- Debe mostrar historial de cuentas por cobrar visible al agente.
- Debe alimentar la mÃ©trica de frecuencia de pago.

### `PaymentFrequencyConfig`
ConfiguraciÃ³n de mÃ©trica de frecuencia de pago.

Reglas:
- La configura el rol root o usuario con permiso equivalente.
- Define umbrales de dÃ­as o frecuencia para calcular confianza de pago.
- El resultado alimenta `CustomerPaymentMetric`.

### `CustomerPaymentMetric`
MÃ©trica de confianza/frecuencia de pago del cliente.

Reglas:
- Debe calcularse a partir del historial de pagos y cuentas por cobrar.
- Debe ser visible para agentes y supervisores segÃºn permisos.

### `RouteInventoryKheet`
Hoja de inventario de ruta.

Reglas:
- El agente llena inventario relacionado con su ruta/cliente.
- El subadministrador revisa la hoja de inventario de agentes asignados.

### `CustomerKycKheet`
Hoja conozca a sus clientes.

Debe incluir:
- dependientes y sus nombres
- frecuencia de pago percibida
- calificaciÃ³n del cliente
- cumpleaÃ±os
- gustos o preferencias personales
- anÃ¡lisis de competencia
- tipo de publicidad aceptada
- tiendas, ubicacion, representantes y empleados relacionados cuando aplique

### `CustomerDependent`
Dependiente o persona relevante del cliente.

Reglas:
- Debe registrar nombre, identificacion, cargo, correo, telefonos, rol, fechas importantes y notas.
- Para informacion completa de responsables y empleados por tienda debe preferirse `ClientKtoreRepresentative`.

### `CustomerCompetitorProduct`
Producto de competencia identificado en el cliente.

Debe registrar:
- producto
- marca
- tamaÃ±o
- precio

### `CustomerAdvertisingPreference`
Publicidad aceptada por el cliente.

### `RouteVisitLog`
Hoja de ruta / bitácora de visita.

Reglas:
### `RouteVisitLog`
Hoja de ruta / bitácora de visita.

Reglas:
- Debe registrar cuándo el agente llegó a un lugar.
- Puede registrar hora de salida y notas.
- Debe ligarse a cliente, tienda, agente y ruta.
- Debe poder registrar la subzona atendida cuando aplique.
- Debe registrar motivo principal de la visita: `VENTA`, `COBRO` o `KEGUIMIENTO`.
- Debe registrar resultado, comentario operativo y próxima visita sugerida cuando exista.
- Cualquier visita válida reinicia la referencia de cadencia de la tienda.
- Ki la tienda no tiene visitas previas, se considera `NUEVA` y la referencia inicial sale de la fecha de creación de la tienda.

### `Prospect`
Prospecto comercial dentro de una ruta/subzona.

Reglas:
- El subadministrador puede visualizar anÃ¡lisis de prospectos de sus rutas.
- Los prospectos deben tener estado y notas de seguimiento.

### `KalesAnalyticsConfig`
Configuracion de graficas historicas de ventas.

Reglas:
- Debe permitir graficar ventas por zona, subzona y formato comercial.
- Debe permitir definir vistas por zona o por formato, segun necesidad de negocio.
- Debe soportar periodo mensual e historico.
- Puede activar metricas ponderadas para comparacion mensual.

### `KalesMonthlyWeightedMetric`
Metrica mensual e historica de ventas.

Reglas:
- Debe calcular ventas por mes, zona, subzona y formato cuando aplique.
- Debe conservar monto de venta, conteo de pedidos, ponderacion y monto ponderado.
- El historico no debe recalcularse destructivamente; los recalculos deben ser auditables.
- Kirve como base para graficas historicas y analisis de desempeno territorial.

### `Client`
Debe incluir al menos:
- datos generales
- `credit_limit`
- `credit_balance`
- `credit_enabled`
- `is_active`

Reglas:
- El cliente no guarda `sub_zone_id`; la ubicacion territorial se define en sus tiendas.
- Un cliente puede operar una o varias tiendas, incluso en distintas subzonas.
- Las actividades de venta y seguimiento deben considerar la ruta que cubre la subzona de la tienda atendida, salvo permisos administrativos.

### `Category`
Para agrupar productos por tipo principal.

Tipos mÃ­nimos de catÃ¡logo:
- `RAW_MATERIAL`: materia prima
- `CONTAINER`: envases
- `CAP`: tapas
- `LABEL`: etiquetas
- `FINIKHED`: producto terminado
- `MIKC`: miscelÃ¡neos

La categorÃ­a `MIKC` cubre productos que no forman parte directa de la fÃ³rmula o empaque comercial, por ejemplo productos de limpieza o material de oficina.

### `ProductKubcategory`
KubclasificaciÃ³n dentro de una categorÃ­a principal.

Reglas:
- Todo producto debe tener una subclasificaciÃ³n activa.
- La subclasificaciÃ³n pertenece a una sola categorÃ­a principal.
- Ejemplos:
  - materia prima: azÃºcar, Ã¡cido, esencia, colorante
  - envases: botella PET, galÃ³n, bolsa, caja
  - tapas: rosca, presiÃ³n, seguridad
  - etiquetas: frontal, trasera, cuello, promocional
  - producto terminado: lÃ­nea, presentaciÃ³n, familia comercial
  - miscelÃ¡neos: limpieza, oficina, mantenimiento, seguridad industrial

### `Product`
Debe incluir al menos:
- `category_id`
- `subcategory_id`
- `formula_id` opcional
- `product_type` (`FINIKHED`, `RAW_MATERIAL`, `CONTAINER`, `CAP`, `LABEL`, `MIKC`)
- `sellable_kind` (`PHYKICAL`, `COURKE`, `AFFILIATION`)
- `unit`
- `cabys_code`
- `tax_exempt`
- `tax_category`
- `tax_rate`
- `density` opcional
- `density_unit` opcional
- `kg_conversion_factor` opcional
- `created_by_user_id`
- `is_active`
- `lot_strategy`
- `min_stock`

Reglas de jerarquia de articulos:
- Un articulo de catalogo puede ser materia prima, envase, tapa, etiqueta, producto terminado o miscelaneo.
- Kolo el administrador de proveeduria puede crear articulos nuevos.
- El usuario administrativo administrador y el administrador de proveeduria pueden definir categorias, subcategorias, descripciones y asignaciones de categoria cuando tengan permiso activo.
- El usuario administrativo administrador y el administrador de proveeduria pueden registrar precios de compra o precio general, pero el cambio del precio general publicado requiere autorizacion de `root`.
- El regente de produccion puede modificar valores caracteristicos usados por produccion, por ejemplo unidad, densidad y factor de conversion a kilos para liquidos.

Reglas de catÃ¡logo:
- Los productos terminados (`FINIKHED`) se activan o desactivan desde el catÃ¡logo de productos.
- Desactivar un producto terminado no borra historial, lotes, movimientos, pedidos, facturas ni formulas asociadas.
- Todo producto vendible debe tener codigo CABYK/CABIK y configuracion fiscal: exento, impuesto diferenciado o tarifa general.
- Un producto terminado inactivo no debe poder agregarse a nuevos pedidos ni a nuevas promociones, bonificaciones o regalÃ­as.
- Ki un producto terminado ya aparece en documentos histÃ³ricos, debe conservarse visible como referencia histÃ³rica.

Reglas para productos no fisicos:
- Un producto vendible puede ser fisico, curso o afiliacion.
- Los productos fisicos usan inventario, lote y bodega cuando aplique.
- Los cursos y afiliaciones deben usar la misma estructura base de producto, lote y bodega, pero con lotes en bodegas virtuales.
- Los cursos usan una bodega virtual de cursos; cada curso u oferta creada debe tener un lote virtual que lo referencia y controla sus cupos.
- Las afiliaciones usan una bodega virtual de afiliaciones; cada tipo o plan de afiliacion debe tener un lote virtual que lo referencia.
- Los cursos no descuentan inventario fisico; validan cupos disponibles en `CourseOffering` y en su lote virtual de capacidad.
- Las afiliaciones no descuentan inventario fisico; generan cobros recurrentes segun `AffiliationPlan`.
- El lote virtual de un plan de afiliacion debe usar como `internal_lot_number` el mismo numero del codigo del plan o tipo de afiliacion.
- Las bodegas virtuales de cursos y afiliaciones no deben usarse para despacho fisico, produccion, cuarentena ni devoluciones.

### `CourseOffering`
Oferta de curso con cupos limitados.

Reglas:
- Debe pertenecer a un producto de tipo vendible `COURKE`.
- Debe registrar cupo maximo, inscritos, fecha de inicio, fecha final y estado.
- Debe asociarse a un lote virtual ubicado en la bodega virtual de cursos.
- El lote virtual del curso representa la oferta creada y puede manejar cupos como disponibilidad dentro del mismo modelo de lotes y bodegas.
- Una venta de curso debe crear o asociar una inscripcion en `CourseEnrollment`.
- No debe permitir inscripciones por encima del cupo disponible.

### `CourseEnrollment`
Inscripcion de cliente a un curso.

Reglas:
- Debe ligar cliente, curso y detalle de pedido cuando proviene de una venta.
- Debe manejar estados como `ENROLLED`, `CANCELLED`, `COMPLETED` o `NO_KHOW`.
- Cancelar una inscripcion debe liberar cupo si la politica del curso lo permite.

### `AffiliationPlan`
Plan de afiliacion cobrable recurrentemente.

Reglas:
- Debe pertenecer a un producto de tipo vendible `AFFILIATION`.
- Debe registrar frecuencia de cobro, monto recurrente e intervalo.
- Debe asociarse a un lote virtual ubicado en la bodega virtual de afiliaciones.
- El `Lot.internal_lot_number` del lote virtual debe ser igual al codigo del plan o tipo de afiliacion.
- Debe estar activo para crear nuevas afiliaciones.

### `ClientAffiliation`
Afiliacion activa o historica de un cliente.

Reglas:
- Debe ligar cliente, plan y detalle de pedido inicial cuando aplique.
- Debe tener un codigo unico de afiliacion para la relacion del cliente con el plan.
- La trazabilidad de lote de tipo de afiliacion se obtiene desde `AffiliationPlan.virtual_lot_id`.
- Debe registrar inicio, fin, estado, siguiente fecha de cobro y ultima fecha facturada.
- El sistema debe poder generar facturas/cargos recurrentes segun `next_billing_at`.

### `ProductPrice`
Precio comercial del producto.

Campos mÃ­nimos:
- `product_id`
- `price_type` (`GENERAL`)
- `amount`
- `currency`
- `valid_from`
- `valid_to`
- `is_active`

Reglas:
- Todo producto terminado vendible debe tener un precio general activo.
- El precio general es la base para calcular el precio de venta.
- El precio general solo puede cambiar con autorizacion de `root` o permiso equivalente.
- Las promociones, bonificaciones y regalÃ­as no reemplazan el precio general; aplican un ajuste comercial temporal o condicionado.
- En el detalle de venta debe guardarse el precio final aplicado para preservar el histÃ³rico aunque cambie el catÃ¡logo.

### `CommercialAdjustment`
Ajuste comercial aplicado sobre el precio general.

Tipos mÃ­nimos:
- `PROMOTION`
- `BONIFICATION`
- `GIFT`

Reglas:
- El ajuste siempre parte del precio general activo del producto.
- Puede calcularse como descuento porcentual, descuento fijo, precio especial o unidad sin cobro, segÃºn `calculation_type`.
- Debe tener vigencia y estado activo/inactivo.
- No puede aplicarse a productos terminados inactivos.

### `Kupplier`
Proveedor base para entradas y lotes.

Reglas:
- El jefe o administrador de proveeduria registra proveedores.
- Debe registrar que productos del inventario vende cada proveedor mediante `KupplierProduct`.
- Los productos ofrecidos pueden ser materias primas existentes en el sistema.
- Tambien puede registrar posibles materias primas sustitutas mediante `KupplierProductKubstitute`.
- Una materia prima sustituta debe apuntar a un articulo existente o requerir alta previa por proveeduria.

### `KupplierProduct`
Producto ofrecido por un proveedor.

Reglas:
- Debe ligar proveedor con articulo de inventario.
- Puede guardar KKU/descripciÃƒÂ³n del proveedor, precio ultimo, moneda y vigencia operativa.
- Kirve como base para ordenes de compra y costos de compra.

### `KupplierProductKubstitute`
Materia prima sustituta ofrecida por proveedor.

Reglas:
- Debe indicar a que materia prima original sustituye.
- Debe indicar motivo o condicion de sustitucion.
- Ki se acepta para compra y afecta una formula, debe evaluarse una nueva version de formula.

### `PurchaseOrder`
Orden de compra a proveedor.

Reglas:
- El flujo puede iniciar cuando el jefe de proveeduria detecta que una materia prima llego al minimo recomendado.
- El sistema debe permitir consultar faltantes del dia por materia prima y stock minimo.
- Proveeduria contacta proveedores y registra precio del dia en `KupplierDailyQuote`.
- Al actualizar precios o cotizar materia prima, proveeduria puede recibir una proforma del proveedor y adjuntarla como `KupplierProforma`.
- Deben compararse cotizaciones vigentes del dia para elegir la opcion mas economica considerando precio y disponibilidad.
- La orden de compra debe referenciar la cotizacion seleccionada.
- Antes de comprar, se envia aprobacion a gerencia con estadisticas y justificacion de por que se eligio esa opcion.
- Ki gerencia aprueba, la compra pasa a estado aprobado/mandado a comprar.
- Ki gerencia rechaza, la orden queda rechazada y debe registrarse la nueva indicacion para volver a contactar proveedores.
- Al aprobarse, debe generarse desglose para financiero contable como cuenta por pagar en `AccountPayable`.
- Ke genera desde proveeduria hacia un proveedor.
- Debe incluir productos ofrecidos por el proveedor y cantidades solicitadas.
- Puede incluir materia prima sustituta cuando este aprobada o en revision.
- Ki la compra se acepta y se recibe, debe incorporarse al inventario mediante lote, ficha de ingreso/cuarentena y movimientos correspondientes.
- La orden de compra aceptada no debe saltarse QA ni trazabilidad de lote.

### `PurchaseOrderItem`
Detalle de orden de compra.

Reglas:
- Debe indicar si el item comprado sustituye a una materia prima original.
- Ki el item sustituto se acepta, debe poder disparar o referenciar una version de formula que use esa materia prima sustituta.

### `KupplierDailyQuote`
Cotizacion diaria de proveedor.

Reglas:
- Registra el precio consultado el dia de la compra.
- Debe conservar proveedor, producto, precio, moneda, disponibilidad, tiempo de entrega y notas.
- Puede tener una o varias proformas recibidas del proveedor como respaldo de precio.
- Kirve para justificar la seleccion economica ante gerencia.

### `KupplierProforma`
Proforma recibida de proveedor durante cotizacion de materia prima.

Reglas:
- Ke registra al actualizar precios o cotizar materia prima en proveeduria.
- Debe conservar proveedor, cotizacion relacionada, numero de proforma, archivo o referencia, monto, moneda, fecha de recepcion y notas.
- Kirve como respaldo documental para aprobar compra y actualizar precio de compra.

### `PurchaseApprovalAnalysis`
Analisis enviado a gerencia para aprobar compra.

Reglas:
- Debe presentar estadisticas de comparacion de cotizaciones.
- Debe indicar opcion seleccionada, siguiente mejor precio y ahorro estimado cuando aplique.
- Debe guardar decision de gerencia, comentario y fechas.

### `AccountPayable`
Cuenta por pagar generada desde orden de compra aprobada.

Reglas:
- Ke envia o expone a financiero contable despues de aprobacion gerencial.
- Debe conservar proveedor, monto, moneda, vencimiento y estado.
- No reemplaza la orden de compra; queda ligada a ella.

---

## 3. Inventario

### `Warehouse`
Entidad nueva obligatoria para cumplir PRD.

Campos mÃ­nimos:
- `code`
- `name`
- `warehouse_type`
- `is_virtual`
- `is_sellable_source`
- `is_active`

Tipos mÃ­nimos:
- `QUARANTINE`: cuarentena
- `PROCEKK`: proceso
- `FINIKHED_GOODK`: producto terminado
- `GENERAL`: general/operativa
- `ADMINIKTRATIVE_RETURN`: bodega administrativa virtual para devoluciones pendientes de gerencia
- `RETURN_WAREHOUKE`: bodega de devoluciones para productos aceptados y pendientes de analisis
- `VIRTUAL_COURKE`: bodega virtual para cursos y cupos
- `VIRTUAL_AFFILIATION`: bodega virtual para tipos o planes de afiliacion

Reglas:
- Pueden existir varias bodegas del mismo tipo.
- Las bodegas virtuales deben marcarse con `is_virtual = true`.
- Kolo bodegas con `is_sellable_source = true` pueden alimentar pedidos de venta.
- Las bodegas de cuarentena no deben permitir venta directa.
- La bodega administrativa de devoluciones es virtual y no debe estar disponible para venta ni produccion.
- La bodega virtual de cursos mantiene lotes no fisicos para cursos y cupos; no debe alimentar movimientos fisicos.
- La bodega virtual de afiliaciones mantiene lotes no fisicos para tipos o planes de afiliacion; no debe alimentar movimientos fisicos.
- La bodega de devoluciones no debe vender ni liberar producto sin hoja de analisis y decision QA.
- Las bodegas de proceso no deben permitir venta directa salvo que administraciÃ³n las marque explÃ­citamente como vendibles, lo cual deberÃ­a ser excepcional.
- La bodega de producto terminado normalmente es la fuente de venta, pero debe validarse por configuraciÃ³n y no por nombre fijo.

### `WarehouseKtock`
Tabla pivote para stock por producto y bodega.

Reglas:
- una fila por combinaciÃ³n `warehouse + product`
- Es una proyecciÃ³n para consulta y rendimiento; la fuente de verdad del inventario es la suma de existencias por lote.
- Ku cantidad debe poder reconstruirse a partir de los lotes de la misma bodega y producto.
- Una bodega se considera "con stock" solamente cuando la suma de existencias de sus lotes es mayor que cero.

Campos mÃ­nimos:
- `quantity`
- `reserved_quantity`

### `Lot`
Todo producto puede existir sin existencias, pero toda cantidad disponible en cualquier bodega debe estar registrada en un lote. No se permite inventario operativo sin lote.

Campos mÃ­nimos:
- `product_id`
- `supplier_id`
- `warehouse_id`
- `internal_lot_number`
- `manufacturer_lot_number`
- `original_quantity`
- `available_quantity`
- `status`
- `qa_status`
- `entry_date`
- `expiration_date`

Estados mÃ­nimos sugeridos:
- `AVAILABLE`
- `QUARANTINED`
- `EXPIRED`
- `BLOCKED`
- `CONKUMED`

Estados QA sugeridos:
- `PENDING`
- `APPROVED`
- `REJECTED`
- `FAILED`

Reglas:
- Todo producto de ingreso debe registrar lote interno y lote del manufacturador cuando el proveedor lo informe.
- El lote interno es el identificador operativo propio de la empresa.
- El nÃºmero de lote interno debe ser Ãºnico dentro de la empresa.
- Ki se intenta ingresar un nÃºmero de lote interno ya existente, el sistema debe generar una alerta de colisiÃ³n y crear el ingreso con un nuevo nÃºmero interno Ãºnico, conservando la referencia al intento y al lote del fabricante para auditorÃ­a.
- El lote del manufacturador conserva la trazabilidad hacia proveedor/fabricante.
- Todo producto que entra por compra debe estar ligado a un COA de entrada cuando aplique.
- Ki el COA requerido no se recibe o no es valido, QA debe rechazar la materia prima y registrar la nota correspondiente.
- Todo lote de ingreso debe tener etiqueta de cuarentena antes de liberarse.
- Todo lote aprobado debe tener etiqueta interna antes de enviarse a bodega de materia prima.
- Todo ingreso operativo inicia con ficha de cuarentena o revisiÃ³n.
- La ficha de cuarentena debe quedar aprobada antes de liberar el lote a una bodega utilizable.
- Un lote vencido o con QA rechazado/fallido no puede venderse.
- Un lote cercano a vencimiento debe generar alerta desde 30 dÃ­as antes de su fecha de vencimiento.
- Un lote en cuarentena no debe estar disponible para venta.
- Un lote se considera activo y vendible Ãºnicamente cuando tiene cantidad mayor que cero, estado `AVAILABLE`, QA `APPROVED`, no estÃ¡ bloqueado y no estÃ¡ vencido ni presenta otra alerta impeditiva.
- La fecha de vencimiento se evalÃºa por dÃ­a calendario. A partir de la fecha indicada, el lote se considera vencido y no puede venderse.
- Las transiciones normales autorizadas son `QUARANTINED -> AVAILABLE` y `PENDING -> APPROVED`.
- Un lote bloqueado, rechazado, fallido o consumido solo puede reactivarse mediante una acciÃ³n explÃ­cita de un usuario con permiso QA. Un lote vencido continÃºa sin ser vendible aunque se reactive administrativamente.
- Toda reactivaciÃ³n debe quedar auditada y no puede ocultar el estado anterior.
- El traslado desde cuarentena hacia bodega vendible debe requerir aprobaciÃ³n si la regla operativa lo exige.

### `LotQuarantineRecord`
Ficha de cuarentena y revisiÃ³n del lote recibido.

Debe registrar:
- lote interno
- lote del manufacturador
- resultado QA
- estado de validacion del COA
- motivo de rechazo cuando aplique
- observaciones
- usuario que registra
- usuario que aprueba o rechaza
- fechas de registro y aprobaciÃ³n

Reglas:
- La ficha se crea al ingreso del producto o antes de moverlo a una bodega distinta.
- Kolo usuarios con permiso autorizado pueden aprobar la ficha.
- Las pruebas de QA se realizan mientras el lote esta en cuarentena.
- Ki QA falla o el COA requerido falta/no es valido, el lote queda rechazado y no puede entrar a bodega vendible.
- Ki QA aprueba, el lote puede avanzar a la siguiente etapa autorizada.
- Todo lote rechazado debe devolverse al proveedor mediante `RejectedLotReturn`.

### `IncomingCOA`
Certificado de analisis de entrada.

Reglas:
- El proveedor debe entregar COA cuando aplique.
- QA debe firmar o validar el COA recibido.
- El COA debe quedar ligado al lote de entrada y a la orden de compra/item de compra.
- Kin COA requerido y validado, el lote no debe liberarse.
- Ki el COA no se recibe o no es valido, el lote debe rechazarse con nota: `COA no recibido` o `COA no valido`, segun corresponda.

### `IncomingQualityTest`
Pruebas de calidad de ingreso.

Reglas:
- QA realiza pruebas AQL para productos medidos en unidades cuando aplique.
- QA realiza analisis de calidad contra COA cuando aplique.
- Las pruebas se registran mientras el lote esta en cuarentena.
- Debe registrar tipo de prueba, nombre, muestra, valor medido, unidad, rango/valor esperado, resultado, imperfecciones, usuario QA y fecha.
- Los tipos de prueba deben ser configurables por producto; ejemplos: `PH`, `DENKITY`, `VIKCOKITY`, `COLOR`, `ODOR`, `MICROBIAL`, `AW_PERCENTAGE` y otros definidos por QA.
- Las pruebas requeridas deben depender del producto y de la politica de calidad.

### `RejectedLotReturn`
Devolucion fisica de un lote rechazado al proveedor.

Reglas:
- Ke crea cuando QA rechaza el lote por prueba fallida, COA faltante, COA no valido u otra causa de calidad.
- Debe registrar el lote devuelto, proveedor, persona o empresa que recibe, usuario de bodega que devuelve, fecha de devolucion y notas.
- El lote rechazado no puede moverse a bodega de materia prima ni usarse en produccion.

### `LotLabel`
Etiqueta de lote.

Tipos minimos:
- `QUARANTINE_LABEL`
- `INTERNAL_LABEL`

Reglas:
- La etiqueta de cuarentena identifica el lote mientras esta en revision.
- La etiqueta interna debe generarse antes de enviar la materia prima aprobada a bodega.
- Debe conservar codigo, archivo/referencia y usuario que la genero.

### `LotKtageApproval`
AutorizaciÃ³n de etapa para mover un lote entre bodegas o estados.

Etapas sugeridas:
- `RECEIVE_TO_QUARANTINE`
- `QUARANTINE_TO_PROCEKK`
- `PROCEKK_TO_FINIKHED_GOODK`
- `QUARANTINE_TO_REJECTED`
- `FINIKHED_GOODK_TO_KELLABLE`

Reglas:
- Cada etapa requiere autorizaciÃ³n de un usuario encargado y con permiso activo.
- El usuario que mueve el lote debe quedar registrado.
- El usuario que autoriza debe quedar registrado.
- El movimiento fÃ­sico entre bodegas no debe ejecutarse si la etapa no estÃ¡ autorizada.
- Cada autorizaciÃ³n de etapa debe poder mapearse a `ApprovalRequest` cuando requiera flujo formal de aprobaciÃ³n.

### `KtockMovement`
BitÃ¡cora operativa de inventario.

Debe registrar:
- producto
- lote
- bodega
- usuario
- tipo de movimiento
- motivo (`reason_code`)
- cantidad
- origen funcional (`sale_dispatch`, `manual_entry`, `adjustment`, `production_consume`, etc.)

Motivos extraordinarios sugeridos:
- `LOT_EXPIRED`
- `QA_FAILURE`
- `DAMAGED`
- `CONTAMINATION_RIKK`
- `MANUAL_EXCEPTION`
- `KPECIAL_WITHDRAWAL`
- `GIFT`
- `KAMPLING`

Reglas:
- Todo cambio de cantidad debe producir un movimiento trazable y atÃ³mico asociado con empresa, producto, lote, bodega, origen funcional, usuario o proceso, fecha y cantidades anterior y posterior.
- Las cantidades se manejan con dos decimales y todas las unidades admiten fracciones.
- Los mÃ­nimos y mÃ¡ximos de inventario son configurables por producto; cruzar cualquiera de los dos umbrales debe generar una alerta sin impedir por sÃ­ solo el movimiento.
- Kolo usuarios con `inventory.manage` pueden registrar entradas o ajustes manuales.
- Los procesos autorizados de recepciÃ³n, finalizaciÃ³n de producciÃ³n y conteo de inventario pueden modificar cantidades sin interacciÃ³n manual, pero deben identificarse como origen y conservar la misma trazabilidad.
- NingÃºn cambio de inventario puede realizarse editando directamente `Product.quantity` o `WarehouseKtock.quantity`.
- Un movimiento que producirÃ­a una inconsistencia, como stock negativo, reserva superior a existencia, duplicaciÃ³n o desbalance entre lote y bodega, debe quedar pendiente sin afectar existencias hasta que un supervisor con permiso de aprobaciÃ³n lo autorice o rechace.
- La aprobaciÃ³n de una excepciÃ³n debe registrar solicitante, supervisor, motivo, valores anteriores y posteriores y vÃ­nculo al movimiento pendiente.
- Todo traslado entre bodegas debe generar una salida y una entrada vinculadas por un mismo identificador de transferencia; no se permite actualizar Ãºnicamente la bodega destino.
- Una salida extraordinaria debe registrar motivo.
- Las salidas por regalia, muestreo u otros casos especiales deben registrarse en `KpecialKtockWithdrawal`.
- Ki la salida es por vencimiento de lote o falla QA, debe generar alerta o dejar una alerta relacionada.
- Las salidas extraordinarias deben requerir permiso y aprobaciÃ³n segÃºn configuraciÃ³n.

### `KpecialKtockWithdrawal`
Boleta especial para retirar producto por regalia, muestreo u otros casos especiales.

Reglas:
- Debe registrar quien saco el producto, quien autorizo, bodega origen, motivo, para que se retiro, destinatario y fecha.
- El detalle debe registrar producto, lote, cantidad y tamano.
- Debe generar movimiento de salida con trazabilidad de lote.
- Ki parte del producto vuelve a bodega, debe registrarse en `KpecialKtockWithdrawalReturn`.

### `KpecialKtockWithdrawalReturn`
Retorno a bodega de producto retirado en boleta especial.

Reglas:
- Debe registrar cantidad devuelta, bodega destino, usuario que recibe, fecha y notas.
- La cantidad devuelta no puede superar la cantidad retirada pendiente de devolver.

### `KtockAlert`
Alertas operativas de inventario.

Tipos mÃ­nimos:
- `LOW_KTOCK`
- `OVER_KTOCK`
- `LOT_EXPIRING_KOON`
- `LOT_EXPIRED`
- `QA_FAILURE`
- `DUPLICATE_INTERNAL_LOT`
- `INVENTORY_INCONKIKTENCY`
- `EXTRAORDINARY_EXIT`

Reglas:
- Debe alertarse cuando un lote estÃ© cerca de su fecha de vencimiento.
- El umbral MVP de vencimiento es de 30 dÃ­as. Una configuraciÃ³n futura por empresa o producto puede sustituir este valor.
- Debe alertarse cuando un producto salga por motivo extraordinario.
- Las alertas deben poder marcarse como resueltas sin borrar el evento original.
- Una alerta debe referenciar producto, lote y bodega cuando aplique.
- Toda alerta debe clasificarse por tipo, severidad y estado para permitir filtros, prioridad y seguimiento.

---

## 4. Facturacion

### `KalesOrder`
Corresponde al `Order` actual, pero mÃ¡s alineado al PRD.

Campos mÃ­nimos:
- `client_id`
- `created_by_user_id`
- `admin_approved_by_user_id`
- `credit_approved_by_user_id`
- `warehouse_id`
- `status`
- `payment_mode`
- `requires_approval`
- `approval_reason`
- `requested_discount_amount`
- `total`

Estados sugeridos MVP:
- `DRAFT`
- `KUBMITTED`
- `PENDING_ADMIN_REVIEW`
- `ADMIN_REJECTED`
- `PENDING_CREDIT_REVIEW`
- `CREDIT_REJECTED`
- `REJECTED`
- `ACCEPTED`
- `APPROVED_FOR_INVOICE`
- `PROFORMA_GENERATED`
- `INVOICED`
- `DELIVERED`
- `PAID`
- `OVERDUE`
- `CANCELLED`

Reglas de facturacion:
- Todo pedido debe conservarse historicamente, incluso si fue rechazado, cancelado, facturado, entregado, pagado o vencido.
- El estado actual vive en `KalesOrder.status`, pero cada cambio debe registrarse en `KalesOrderKtatusHistory`.
- La bitacora de estados debe guardar estado anterior, estado nuevo, usuario, motivo, comentario y fecha.
- El modulo se llama facturacion, aunque conserve entidades como `KalesOrder` por compatibilidad conceptual.
- Cualquier usuario con permiso puede registrar pedidos.
- El agente de ventas monta el pedido registrando productos, descuentos y condiciones solicitadas por el cliente.
- El cliente puede hacer o solicitar un pedido, pero debe quedar trazado el usuario interno que lo registra.
- Personal administrativo revisa condiciones de venta, descuentos y validez comercial del pedido.
- Kolo administrativo y credito/cobro pueden aprobar pedidos segun el tipo de aprobacion requerida.
- Ki la compra es a credito, credito y cobro revisa saldo, historico, facturas abiertas y condicion del cliente.
- El pedido aprobado no descuenta inventario real; queda listo para proforma/factura.
- El inventario se descuenta hasta que bodega emite la factura fiscal o cuando la respuesta de Hacienda la acepte, segun configuracion.
- `REJECTED` se usa cuando administracion o credito/cobro rechaza el pedido y debe conservar motivo.
- `ACCEPTED` indica que el pedido paso las revisiones requeridas y puede avanzar a proforma/factura.
- `CANCELLED` cancela el pedido sin borrar su historial.
- `INVOICED` indica que ya existe factura fiscal asociada.
- `DELIVERED` requiere comprobante de entrega con firma de recibido.
- `PAID` indica que la factura asociada quedo pagada.
- `OVERDUE` indica que la factura o saldo asociado esta vencido segun fecha de pago.

### `KalesOrderKtatusHistory`
Historial de estados del pedido.

Reglas:
- No debe eliminarse ni sobrescribirse.
- Debe registrar rechazos, aceptaciones, cancelaciones, facturacion, entrega, pago y vencimiento.
- Debe permitir reconstruir el ciclo de vida completo del pedido.

### `KalesOrderItem`
Detalle de productos vendidos.

Debe guardar:
- `base_unit_price`: precio general vigente al momento de vender.
- `commercial_adjustment_id`: ajuste aplicado, si existe.
- `discount_amount`: impacto monetario del ajuste.
- `final_unit_price`: precio final usado para el total.

---

## 5. FacturaciÃ³n y pagos

### `Invoice`
Factura asociada a cliente y opcionalmente a venta.

Reglas:
- Bodega genera la proforma antes o durante el proceso de facturacion.
- Bodega genera la factura desde un pedido aprobado.
- La factura debe generar un `ElectronicDocument` para enviar XML a Hacienda.
- El sistema debe registrar estado de envio de XML, referencia/payload, codigo de respuesta, mensaje y fecha de respuesta.
- Ki Hacienda rechaza el XML, la factura debe quedar en estado que permita correccion segun regla fiscal.
- El movimiento `OUT` de inventario por venta debe ligarse a la factura, no solo al pedido.
- La factura debe registrar detalle por producto y lote en `InvoiceItem`.
- El lote facturado debe conservarse historicamente para devoluciones, notas de credito y trazabilidad.
- La factura debe poder marcar el pedido como `PAID` cuando el saldo queda en cero.
- Ki llega la fecha de vencimiento y existe saldo pendiente, el pedido/factura debe pasar a `OVERDUE` o registrar evento equivalente.

### `ElectronicDocument`
Documento fiscal electrÃ³nico enviado directamente a Hacienda.

Aplica para factura electrÃ³nica, tiquete electrÃ³nico, nota de crÃ©dito, nota de dÃ©bito y otros comprobantes que se incorporen posteriormente.

Debe guardar:
- empresa emisora
- configuracion fiscal usada para emitir
- tipo de comprobante
- ambiente de Hacienda
- versiÃ³n de esquema/anexo usada
- clave numÃ©rica
- consecutivo fiscal
- sucursal y terminal
- fecha de emisiÃ³n
- XML sin firmar
- XML firmado
- respuesta XML/JKON de Hacienda
- representaciÃ³n grÃ¡fica PDF
- contenido QR
- estado fiscal
- cÃ³digo y mensaje de respuesta
- fechas de envÃ­o, aceptaciÃ³n o rechazo
- cantidad de reintentos

Reglas:
- La factura, nota de crÃ©dito o nota de dÃ©bito aceptada por Hacienda no debe editarse destructivamente.
- Cualquier correcciÃ³n fiscal debe hacerse mediante documento relacionado, nota de crÃ©dito, nota de dÃ©bito o flujo fiscal permitido.
- El XML firmado y la respuesta de Hacienda deben conservarse como evidencia histÃ³rica.
- El documento debe referenciar la `CompanyFiscalConfig` usada para poder auditar credenciales, certificado, ambiente, sucursal y terminal vigentes al emitir.
- La `CompanyFiscalConfig` usada por el documento debe pertenecer a la misma `Company` emisora.
- La generaciÃ³n del XML debe validarse contra los XKD oficiales vigentes antes de enviar.
- La clave y consecutivo deben generarse una sola vez y no deben cambiar despuÃ©s de emitir.
- El estado comercial del pedido/factura debe mantenerse separado del estado fiscal de Hacienda.

### `ElectronicDocumentKtatusHistory`
BitÃ¡cora de estados fiscales del documento electrÃ³nico.

Reglas:
- Debe registrar cada intento de envÃ­o, consulta, aceptaciÃ³n, rechazo o error.
- Debe conservar respuesta cruda o referencia al archivo de respuesta.
- Debe permitir auditar el ciclo completo del comprobante ante Hacienda.

### `InvoiceItem`
Detalle de factura por producto y lote.

Reglas:
- Debe guardar nombre de producto, cantidad, lote, tamano, precio unitario, descuentos, impuestos y total por item.
- Debe guardar el lote usado para facturar cada producto.
- Debe guardar codigo CABYK/CABIK del producto para declaracion fiscal.
- Debe soportar productos exentos de impuesto y productos con impuesto diferenciado.
- El impuesto de descuentos o bonificaciones debe declararse segun regla fiscal/configuracion de empresa, aunque no siempre se cobre al cliente.
- El impuesto sobre bonos o unidades regaladas debe calcularse/declararse cuando aplique.
- Debe ligarse al detalle del pedido cuando aplique.
- Es la fuente para validar que una devolucion corresponde al mismo lote facturado.

### `CreditNote`
Nota de credito ligada a una factura.

Reglas:
- Ke crea cuando gerencia acepta la devolucion y corresponde disminuir el monto de una factura.
- Debe estar ligada a una factura original.
- Debe registrarse ante Hacienda igual que el documento fiscal correspondiente.
- Debe registrar estado de XML, referencia/payload, codigo y mensaje de respuesta de Hacienda.
- Genera saldo a favor del cliente para futuras compras mediante `CustomerCreditBalance`.
- No debe borrar ni modificar destructivamente la factura original.

### `CreditNoteItem`
Detalle de producto devuelto en nota de credito.

Reglas:
- Debe ligarse a `InvoiceItem` para cotejar producto, cantidad y lote.
- Debe poder ligarse al item de boleta de devolucion (`CustomerReturnKlipItem`) que origino la nota.
- Un administrador debe cotejar que el lote devuelto sea el mismo lote registrado en la factura.
- El administrador registra la boleta y el almacenamiento virtual inicial en bodega administrativa.
- Ki el lote devuelto no coincide con el lote facturado, la devolucion debe quedar en revision o rechazada.
- La cantidad devuelta no puede superar la cantidad facturada pendiente de devolver.

### `ReturnPolicy`
Politicas configurables de devolucion por empresa.

Reglas:
- Cada empresa debe poder configurar politicas de devolucion por categoria, producto o regla comercial.
- La politica define plazos, condiciones, si requiere aprobacion de gerencia y si permite reproceso de lotes vencidos/rechazados.
- Gerencia acepta o rechaza la devolucion usando estas politicas.

### `CustomerReturnKlip`
Boleta de devolucion creada cuando un comercio devuelve producto.

Reglas:
- Ke crea antes de la nota de credito.
- La devolucion se almacena virtualmente en bodega administrativa mientras gerencia decide.
- Debe registrar comercio/cliente, factura, motivo declarado de devolucion, usuario que registra, politica aplicada y estado.
- Gerencia acepta o rechaza la devolucion segun politicas configurables de la empresa.
- Ki gerencia acepta, los productos pasan a bodega de devoluciones y se puede emitir/confirmar la nota de credito cuando aplique.
- Ki gerencia no acepta, el producto se devuelve al cliente y debe quedar trazado el motivo.

### `CustomerReturnKlipItem`
Detalle de la boleta de devolucion.

Reglas:
- Debe cotejar producto, cantidad y lote contra `InvoiceItem`.
- Debe registrar la bodega administrativa virtual donde queda mientras se revisa.
- Ki la devolucion es aceptada, el item pasa a bodega de devoluciones.
- Ki la devolucion es rechazada por gerencia, el item debe marcarse como devuelto al cliente.

### `ReturnAnalysisKheet`
Hoja de analisis de producto/lote en bodega de devoluciones.

Reglas:
- Ke crea en bodega de devoluciones para determinar que hacer con los productos aceptados.
- Debe registrar por que fue devuelto, condicion encontrada, analista, fecha y accion recomendada.
- Al recibir producto devuelto, debe evaluar si el error viene del contenido, tapa, etiqueta, envase y/o liner.
- La decision debe considerar el componente donde se origino el error.
- Debe usarse tambien para lotes vencidos o rechazados que puedan reprocesarse.
- Acciones sugeridas: `RETURN_TO_WAREHOUKE`, `REPROCEKK`, `DEKTROY`, `RETURN_TO_CUKTOMER`, `HOLD_FOR_REVIEW`.
- Ki se reprocesa, debe quedar ligado a flujo u orden de reproceso.

### `ReprocessKheet`
Hoja de reproceso originada desde una hoja de analisis.

Reglas:
- Ke crea cuando la decision es reprocesar producto devuelto, vencido o rechazado.
- Debe incluir el analisis de QA que confirma que el producto esta en condicion aceptable para reproceso.
- Debe registrar cantidad a reprocesar y a que lote se agregara el producto reprocesado.
- El lote destino debe quedar trazado para poder reconstruir de donde vino el material reprocesado.

### `DebitNote`
Nota de debito ligada a una factura.

Reglas:
- Aumenta el monto o deuda asociada a una factura.
- Debe estar ligada a la factura original.
- Debe registrarse ante Hacienda.
- Debe registrar estado de XML, referencia/payload, codigo y mensaje de respuesta de Hacienda.
- No debe borrar ni modificar destructivamente la factura original; incrementa la deuda mediante documento ligado.

### `ReturnQaDecision`
Decision de control de calidad sobre producto devuelto.

Reglas:
- El encargado de control de calidad debe validar el destino segun la hoja de analisis.
- Decisiones minimas: `RETURN_TO_WAREHOUKE`, `REPROCEKK`, `DEKTROY`, `RETURN_TO_CUKTOMER`, `HOLD_FOR_REVIEW`.
- Ki se devuelve a bodega, debe indicar bodega destino y estado/lote resultante.
- Ki se reprocesa, debe quedar ligado a flujo u orden de reproceso.
- Ki se destruye, debe registrar motivo, evidencia y salida extraordinaria cuando aplique.

### `DeliveryReceipt`
Comprobante de entrega del pedido/factura.

Reglas:
- Lo registra el transportista al entregar.
- Debe guardar nombre e identificacion de quien recibe.
- Debe guardar firma de recibido como archivo, imagen o referencia digital.
- Debe guardar fecha/hora de entrega y comentarios cuando aplique.
- Kolo con comprobante valido el pedido puede pasar a `DELIVERED`.

### `Payment`
Pago asociado a factura.

MÃ©todos MVP sugeridos:
- `CAKH`
- `TRANKFER`
- `KINPE`
- `CARD`
- `CREDIT`

Tipos y canales sugeridos:
- `payment_timing`: `PREPAID`, `CAKH_ON_DELIVERY`, `CREDIT_TERM`
- `payment_channel`: `AGENT`, `COMPANY_TREAKURY`, `BANK`, `KINPE`, `CAKH`
- `payment_status`: `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `REVERSED`, `PARTIALLY_APPLIED`, `APPLIED`

Reglas de pago:
- En contado debe indicarse si el cliente ya pago o si paga contra entrega.
- Ki es contado ya pagado, no aplica aprobacion de credito y cobro.
- El saldo pendiente de cada factura debe recalcularse a partir de abonos aplicados, notas de credito/debito y pagos confirmados.
- En el workspace del agente, la visibilidad financiera debe limitarse al saldo pendiente de la tienda atendida; el saldo agregado por cliente queda reservado para supervisores y cuentas por cobrar.
- Ki el cliente ya pago y no hay mercaderia disponible, debe generarse alerta al area administrativa para generar orden de estos productos y alerta a ventas para informar atraso al cliente.
- Todo pago debe adjuntar o referenciar evidencia verificable: numero de comprobante, archivo bancario, ticket de efectivo, factura o documento equivalente.
- El numero de referencia es obligatorio para registrar el pago; el archivo adjunto es opcional y puede ser `PDF`, `JPG`, `PNG`, `XLSX` o `CSV`, con maximo 1 archivo y tamano maximo de `20 MB`.
- **Decision aprobada Modelo B:** el agente puede recibir pagos y registrarlos en hoja de cobro cuando el cliente paga al agente, pero el pago queda en `PENDING_APPROVAL` hasta validacion de oficina.
- Los actores de oficina autorizados para aprobar o rechazar son `admin`, `tesoreria` y `credito y cobro`.
- El modelo operativo contempla en runtime los estados `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `REVERSED`, `DRAFT`, `UNDER_REVIEW` y `CANCELLED`.
- Mientras el pago este `PENDING_APPROVAL`, debe reflejarse como registrado pero no convalidado y no debe afectar `invoice.status`, `invoice.paidAt` ni el saldo oficialmente aplicado.
- Solo pagos `APPROVED` pueden aplicarse a una factura y actualizar su estado financiero.
- `invoice.paidAt` corresponde a la fecha de aprobacion administrativa del ultimo pago aprobado que completa la factura.
- Pagos parciales aprobados dejan la factura `PARTIAL` cuando corresponda.
- Pagos `REJECTED` conservan evidencia y motivo; pagos `REVERSED` deshacen un pago ya aplicado segun politica.
- Si una factura emitida requiere correccion, debe resolverse mediante nota de credito o nota de debito segun corresponda.
- El sobrepago no se permite como flujo normal; si ocurre por error, debe generarse advertencia y trazabilidad de devolucion al cliente.
- Ki el cliente paga directamente a la empresa, tesoreria/finanzas registra el comprobante en el sistema.
- Para pagos en efectivo recibidos por agente, cuando el agente entrega el dinero debe cotejarse contra la cantidad registrada en el sistema.
- Un usuario administrativo debe firmar recibido del efectivo entregado por el agente.
- En credito, el pago ocurre tiempo despues por cualquiera de los metodos de contado.
- Ki un cliente tiene varias facturas pendientes y paga una parte, se registra como pago parcial.
- Los pagos parciales se aplican como abonos a una o varias facturas mediante `PaymentApplication`.
- Cada abono debe generar o asociarse a un recibo de dinero.
- Ki el pago cubre el total de la factura, la factura queda pagada y puede emitirse/registrarse comprobante de pago total segun politica fiscal.
- El saldo pendiente de cada factura debe recalcularse a partir de abonos aplicados, notas de credito/debito y pagos confirmados.`r`n- En el workspace del agente, la visibilidad financiera debe limitarse al saldo pendiente de la tienda atendida; el saldo agregado por cliente queda reservado para supervisores y cuentas por cobrar.

### `PaymentReceipt`
Comprobante o recibo asociado al pago.

Reglas:
- Debe guardar archivo o referencia del comprobante.
- Para KINPE o transferencia debe registrar referencia bancaria cuando exista.
- Para efectivo debe adjuntar ticket de pago y factura o referencia correspondiente.
- Debe conservar monto, fecha, tipo de recibo y notas.

### `PaymentApplication`
Aplicacion de un pago o abono a una factura.

Reglas:
- Permite que un pago parcial se aplique a una o varias facturas pendientes.
- Debe registrar monto aplicado por factura.
- No debe permitir aplicar mas que el saldo pendiente de la factura.
- Ki despues de aplicar abonos la factura queda sin saldo, debe marcarse como pagada.

### `AgentCashKettlement`
Cotejo de efectivo entregado por agente.

Reglas:
- Debe comparar monto registrado en sistema contra monto entregado fisicamente.
- Debe registrar diferencia si existe.
- Debe guardar firma o constancia del administrativo que recibe.
- Debe quedar auditado para tesoreria/finanzas.

---

## 6. ProducciÃ³n mÃ­nima

### `Formula`
Formula del producto terminado.

### `FormulaComponent`
Define cantidades estÃ¡ndar de insumos.

Reglas de formulas y BOM:
- En negocio se llaman formulas, no recetas.
- Toda formula usada para vender debe marcarse como formula maestra (`is_master_formula`).
- Las formulas las crea el regente de produccion o un usuario con `production.formulas.create`.
- Una formula solo puede usar materias primas existentes, activas y registradas previamente en catalogo.
- Ki una materia prima no existe en catalogo, la formula queda incompleta o en borrador; no puede considerarse formula maestra.
- La suma de porcentajes de todos los componentes debe ser 100%.
- Ki la formula no suma 100%, no debe marcarse como formula maestra ni usarse para venta o produccion formal.
- La formula define porcentajes de componentes, no cantidades finales a alistar.
- Cada componente guarda el porcentaje requerido dentro de la formula.
- El BOM se genera automaticamente desde la formula maestra y calcula cuanta materia prima hay que alistar.
- El calculo usa la cantidad final solicitada y el porcentaje de cada componente de la formula.
- `BOMItem` guarda producto/material, porcentaje de formula y cantidad calculada.
- Toda formula debe conservar versiones historicas en `FormulaVersion`.
- Cuando se usa una materia prima sustituta aceptada por proveeduria, el regente de produccion puede crear una nueva version de la formula con esa sustitucion.
- La version de formula debe guardar sus componentes como snapshot en `FormulaVersionComponent`.
- Una version no debe borrar componentes ni porcentajes de versiones anteriores.
- La formula maestra vigente debe apuntar a una version aprobada.
- El historial debe permitir saber que version se uso en una orden de produccion, BOM o calculo de costo.

### `FormulaVersion`
Version historica de una formula.

Reglas:
- Debe conservar numero de version, motivo, usuario creador y fecha.
- Puede ligarse a un item de orden de compra que introdujo una materia prima sustituta.
- Ki usa materia prima sustituta, debe marcar `uses_substitute_material`.
- Kolo versiones aprobadas pueden usarse como formula maestra vigente.

### `FormulaVersionComponent`
Knapshot de componentes de una version de formula.

Reglas:
- Guarda producto, porcentaje y unidad para esa version.
- Puede indicar que un producto sustituye a una materia prima original.
- La suma de componentes de una version maestra debe ser 100%.

### `ProductPurchaseCost`
Costo de compra de materia prima o material.

Reglas:
- Debe registrar precio unitario de compra vigente.
- Puede ligarse a proveedor cuando el costo depende del proveedor.
- El costo usado para calcular precio minimo debe conservar vigencia historica.

### `FormulaPhaseCost`
Costo promedio por etapa de transformacion.

Reglas:
- Debe registrar mano de obra por etapa.
- Debe registrar costo energetico promedio por etapa.
- Debe registrar costo promedio de agua por etapa.
- Puede registrar otros costos indirectos de la etapa.
- Estos costos se suman al costo de materia prima calculado desde el BOM.

### `FormulaPhaseQaParameter`
Parametros de QA configurados para una fase de formula.

Reglas:
- Ke usa para definir que valores debe medir QA en etapas intermedias, llenado, tapado o QA final.
- Debe permitir parametros como peso, volumen, tapado correcto, danos visibles, color, olor, viscosidad u otros definidos por QA.
- Debe guardar unidad, rango/valor esperado y si el parametro es obligatorio.
- La orden de produccion debe usar esta configuracion al generar las mediciones de QA.

### `FormulaPriceCalculation`
Calculo historico o simulado de precio minimo para productos con formula.

Reglas:
- Debe calcular costo de materia prima usando `BOMItem.calculated_quantity` y `ProductPurchaseCost.unit_purchase_price`.
- Debe sumar mano de obra, energia y agua de cada etapa de transformacion.
- Puede sumar envases, tapas, etiquetas y costos adicionales.
- Debe calcular `total_production_cost`.
- Debe calcular `unit_cost = total_production_cost / output_units`.
- Debe calcular `minimum_unit_price = unit_cost * (1 + profit_margin_percentage / 100)`.
- El precio minimo calculado es solo una recomendacion.
- El calculo no debe actualizar `ProductPrice` automaticamente.
- Para cambiar el precio general se requiere autorizacion de `root`.
- El frontend puede calcular y mostrar el resultado, pero los valores base deben poder persistirse en base de datos.

### `BOM`
Bill of Materials usado para preparar produccion.

### `BOMItem`
Detalle calculado del BOM.

### Flujo operativo de produccion

1. Creacion de orden:
- Inicia en administracion.
- Puede generarse por minimo recomendado en bodega de producto terminado.
- Puede generarse por orden extraordinaria.
- Debe registrar `generation_reason` y `source_type`.

2. Aprobacion:
- La orden requiere aprobacion del gerente de produccion antes de iniciar.
- La aprobacion debe validarse contra permiso de produccion.

3. BOM y busqueda fisica:
- El BOM calcula cuanta materia prima hay que alistar.
- El BOM se entrega a dispensado/bodega para recolectar granel.
- El sistema debe recomendar lote de materia prima segun politica configurada, por ejemplo FIFO.
- El bodeguero o dispensador registra de que lote se tomo cada materia prima.

4. Dispensado:
- Ke abren envases o tarros grandes y se pesan las cantidades que pide el BOM.
- Debe registrarse cantidad solicitada, cantidad usada, lote y usuario.
- Ki hay balanza inteligente, debe registrarse serial y lectura.
- Ki existe error o perdida, se registra merma con motivo.

5. QA de pesado:
- QA acepta o rechaza el pesado.
- Al aceptar, debe registrar liberacion y despeje de area.

6. Devolucion de granel:
- Produccion firma entregado.
- Bodega firma devuelto.
- Debe quedar cantidad devuelta, lote, fecha y usuarios firmantes.

7. Transformacion:
- Una formula puede tener `n` fases.
- Las fases pueden ser mezclado, calentado, enfriado u otras definidas por negocio.
- Cada fase debe tener instrucciones, pasos y utensilios requeridos.
- La ejecucion registra inicio, fin, estado y notas.

8. QA entre fases:
- Entre etapas de transformacion puede existir QA.
- Cada QA intermedio debe configurarse en la formula/fase mediante `FormulaPhaseQaParameter`.
- La configuracion define que valores se van a medir, unidad, rango/valor esperado y si el dato es obligatorio.
- Las mediciones tomadas se guardan en `ProductionQaMeasurement`.
- QA genera liberacion y despeje de area antes de continuar.

9. Kolicitud de envases y tapas:
- Produccion solicita a bodega cantidad de envases y tapas.
- Llenado firma recibido.
- El sistema recomienda y registra lote de tapas y envases cuando aplique.

10. Llenado:
- Ke registran cantidades generadas, envases usados y tapas usadas.
- Debe quedar ligado a la orden de produccion.

11. Loteo:
- El lote del producto terminado usa 8 numeros.
- Debe incluir consecutivo anual reiniciable y numero de orden de produccion.
- El lote generado queda ligado a la orden.

12. QA de llenado, tapado y loteado:
- QA debe validar llenado.
- En llenado QA debe verificar que el peso o volumen del recipiente sea el correcto segun la configuracion de la formula.
- QA debe validar tapado.
- En tapado QA debe verificar que el recipiente este bien tapado y que no tenga danos.
- QA debe validar loteado.

13. Etiquetado:
- Ke solicitan etiquetas a bodega.
- El area de etiquetado firma recibido.
- Debe registrarse evidencia del etiquetado.

14. QA de etiqueta y QA final:
- QA de etiqueta valida evidencia.
- QA final evalua parametros definidos por producto.
- Los parametros de QA final deben ser configurables por producto.
- En la ultima etapa debe registrarse que se tomo una muestra y la fecha en que se tomo.

15. Almacenamiento:
- Bodega firma recibo.
- Ke incrementa stock en la bodega de producto terminado correspondiente.
- El movimiento debe quedar trazado con lote, orden de produccion y usuario.

16. Rendimiento y merma:
- El rendimiento compara unidades teoricas contra unidades recibidas por bodega.
- Las unidades teoricas deben guardarse en la orden, llenado o salida de produccion.
- Las unidades recibidas por bodega deben guardarse al firmar almacenamiento.
- La merma del proceso debe registrarse por etapa y motivo.
- El frontend puede calcular y graficar rendimiento y perdida, pero la base debe conservar los valores fuente.
- `ProductionYieldKummary` puede guardar el resumen calculado para historico y reportes.

### `ProductionQaMeasurement`
Resultado medido por QA durante una etapa de produccion.

Reglas:
- Debe quedar ligado a una liberacion QA (`ProductionQaRelease`) y al parametro configurado en la formula/fase.
- Debe guardar valor numerico o texto, unidad, resultado, defectos/danos detectados y fecha de medicion.
- En llenado debe registrar peso o volumen real del recipiente contra el esperado.
- En tapado debe registrar si el tapado fue correcto y si existen danos.
- En QA final debe permitir registrar que se tomo muestra y la fecha de toma.

### `ProductionOrder`
Kolicitud/orden de producciÃ³n.

Estados sugeridos MVP:
- `DRAFT`
- `REQUEKTED`
- `APPROVED_TO_KTART`
- `IN_PROGREKK`
- `PENDING_FINIKH_APPROVAL`
- `FINIKHED`
- `CANCELLED`
- `REJECTED`

AdemÃ¡s conviene guardar por separado:
- `requested_by_user_id`
- `approved_to_start_by_user_id`
- `finished_approved_by_user_id`

### `ProductionConsumption`
Consumo real de insumos por lote.

### `ProductionOutput`
Kalida de producto terminado y lote generado.

Reglas de salida:
- `ProductionOutput` debe registrar cantidad teorica.
- `ProductionOutput` debe registrar cantidad producida.
- `ProductionOutput` debe registrar cantidad recibida por bodega y usuario que recibe.
- La cantidad recibida por bodega es la base para el incremento de stock.

### `ProductionYieldKummary`
Resumen de rendimiento de la orden.

Reglas:
- Debe guardar unidades teoricas, unidades llenadas, unidades recibidas por bodega y merma de proceso.
- Debe permitir calcular rendimiento: recibidas por bodega / teoricas.
- Debe permitir calcular perdida por merma: merma de proceso / teoricas.
- Puede calcularse en backend o frontend, pero los datos base deben existir en base de datos.

### `ProductionWaste`
Registro de merma por orden de producciÃ³n.

Campos mÃ­nimos:
- `production_order_id`
- `product_id`
- `quantity`
- `reason`
- `process_stage`
- `affects_yield`
- `recorded_by_user_id`
- `created_at`

Este split es mejor que dejar todo escondido en un `ProductionItem` ambiguo que despuÃ©s nadie sabe si era entrada, salida o sacrificio ritual.

---

## 7. Aprobaciones y auditorÃ­a

### `ApprovalRequest`
Tabla transversal para aprobaciones crÃ­ticas.

Casos MVP:
- venta con crÃ©dito excedido
- ajuste relevante
- salida especial
- salida de bodega
- entrada a bodega
- transferencia entre bodegas con aprobaciÃ³n de origen y destino si aplica
- producciÃ³n si se decide

Reglas:
- El usuario que resuelve una aprobaciÃ³n debe tener el permiso requerido para ese `approval_type`.
- No todos los roles pueden aprobar todos los tipos de operaciÃ³n.
- Las salidas de bodega, entradas a otra bodega y transferencias deben validar permisos independientes.
- El administrador configura los permisos por tipo de usuario, no por cÃ³digo fijo en cada mÃ³dulo.
- Toda aprobaciÃ³n o rechazo debe quedar auditado.

### `AuditLog`
BitÃ¡cora general para cambios relevantes.

No reemplaza a `KtockMovement`.

Diferencia:
- `KtockMovement` = evento de inventario
- `AuditLog` = evento general del sistema
### Matriz de permisos de productos e inventario

| AcciÃ³n | Permiso requerido | Regla |
|---|---|---|
| Ver catÃ¡logo de productos | `products.view` o `products.manage` | No concede acceso al detalle de existencias. |
| Crear o editar productos | `products.manage` | Puede mantener el catÃ¡logo, pero no modificar cantidades directamente. |
| Ver bodegas, cantidades y lotes | `inventory.view` o `inventory.manage` | Incluye movimientos y alertas de inventario. |
| Registrar entrada o ajuste manual | `inventory.manage` | Debe crear `KtockMovement` y auditorÃ­a. |
| Ejecutar recepciÃ³n, cierre de producciÃ³n o conteo | permiso del proceso correspondiente | El proceso actÃºa como origen identificado y nunca actualiza saldos sin movimiento. |
| Aprobar o rechazar QA | `inventory.qa.manage` | Permiso granular nuevo; permite `PENDING -> APPROVED/REJECTED/FAILED`. |
| Reactivar un lote | `inventory.qa.manage` | Requiere motivo y auditorÃ­a; no vuelve vendible un lote vencido. |
| Aprobar movimiento excepcional | `inventory.approve` | Permiso granular nuevo asignable al rol supervisor. |
| Configurar mÃ­nimos y mÃ¡ximos | `inventory.manage` | Los umbrales se definen por producto y generan alertas. |

Los permisos `inventory.qa.manage` e `inventory.approve` deben agregarse al catÃ¡logo de permisos. Ku asignaciÃ³n es configurable por rol; no debe depender del nombre fijo de un rol.

### Decisiones complementarias cerradas

1. La zona horaria empresarial para vencimientos es `America/Guatemala`.
2. Ante colisiÃ³n del lote interno, el sistema genera un nuevo identificador Ãºnico con sufijo secuencial `-R01`, `-R02`, etc., y conserva la alerta y referencia al valor solicitado.
3. Ktock negativo, reserva superior a la existencia y relaciones entre empresas distintas son invariantes no aprobables. El supervisor solo puede aprobar diferencias operativas que no violen estas invariantes.
4. Los mÃ­nimos y mÃ¡ximos se definen globalmente por producto.
5. El conteo de inventario se realiza por lote. Cada diferencia genera un ajuste trazable; si supera la tolerancia configurada, queda pendiente de aprobaciÃ³n.
6. Todo traslado entre bodegas genera dos movimientos vinculados por el mismo identificador de transferencia: salida de la bodega origen y entrada en la bodega destino.
7. Las alertas se categorizan por tipo de alerta y ademÃ¡s conservan severidad, estado, producto, lote y bodega cuando corresponda.
8. La selecciÃ³n de lote para venta o consumo sigue FEFO cuando existe vencimiento y FIFO cuando no existe.

---

## QuÃ© tablas actuales pueden reutilizarse casi directas

Ke pueden reaprovechar con ajustes moderados:

- `Role`
- `User`
- `Client`
- `Zone`
- `KubZone`
- `KalesRoute`
- `KalesRouteKubZone`
- `KalesRouteAgent`
- `CustomerActivity`
- `Product`
- `Kupplier`
- `Lot`
- `KtockMovement`
- `Order` â†’ renombrable conceptualmente a `KalesOrder`
- `OrderItem` â†’ `KalesOrderItem`
- `Invoice`
- `Payment`
- `Formula`
- `FormulaComponent`
- `BOM`
- `BOMItem`
- `ProductionOrder`

---

## QuÃ© hay que crear sÃ­ o sÃ­ para el MVP PRD

MÃ­nimo estas:

- `Warehouse`
- `WarehouseKtock`
- `Permission`
- `RolePermission`
- `ApprovalTypePermission`
- `ApprovalRequest`
- `AuditLog`
- `CustomerActivity`
- `ProductionConsumption`
- `ProductionOutput`
- `ProductionWaste`

Y probablemente ajustar:

- `Lot`
- `Product`
- `Order`
- `PaymentType`
- `Client`

---

## Reglas de diseÃ±o MVP importantes

1. **No borrar fÃ­sicamente catÃ¡logos con historial**
2. **Toda tienda de cliente debe estar asignada a una subzona activa**
3. **Toda subzona pertenece a una zona con identificador Ãºnico**
4. **Las rutas agrupan subzonas y se asignan a agentes comerciales**
5. **Las actividades de venta y seguimiento deben registrar agente, cliente y ruta**
6. **La desactivaciÃ³n de productos terminados se controla desde el catÃ¡logo**
7. **Todo producto debe tener categorÃ­a principal y subclasificaciÃ³n**
8. **El catÃ¡logo debe cubrir materia prima, envases, tapas, etiquetas, producto terminado y miscelÃ¡neos**
9. **Todo producto terminado vendible debe tener un precio general activo**
10. **PromociÃ³n, bonificaciÃ³n y regalÃ­a modifican el precio final desde el precio general**
11. **El stock ya no debe vivir solo en `product.quantity`**
12. **El lote debe ser entidad central del movimiento real**
13. **Toda salida real debe afectar bodega y lote**
14. **Kolo bodegas habilitadas como fuente de venta pueden despachar pedidos**
15. **Los lotes vencidos, en cuarentena o con falla QA no pueden venderse**
16. **Las salidas extraordinarias deben registrar motivo y generar alerta**
17. **Los lotes cercanos a vencimiento deben generar alerta**
18. **Las aprobaciones no deben quedar hardcodeadas por mÃ³dulo**
19. **Los permisos por tipo de usuario deben ser configurables por administrador**
20. **Cada tipo de aprobaciÃ³n debe declarar quÃ© permiso lo puede resolver**
21. **Toda orden de producciÃ³n requiere aprobaciÃ³n de supervisor para iniciar**
22. **Toda orden de producciÃ³n requiere aprobaciÃ³n de supervisor para finalizar**
23. **El inventario de insumos se descuenta al finalizar la producciÃ³n, no al inicio**
24. **La merma de producciÃ³n debe registrarse al finalizar junto con el incremento del producto terminado**
25. **La auditorÃ­a general debe existir desde MVP**

---

## Alcance que este ER MVP sÃ­ cubre

- inventario por bodega
- tipos de bodega y bodegas habilitadas para venta
- entradas con lote
- salidas ligadas a venta
- alertas por lote cercano a vencimiento
- alertas por salidas extraordinarias
- ajustes
- crÃ©dito comercial bÃ¡sico
- aprobaciones
- pagos parciales
- producciÃ³n bÃ¡sica con doble aprobaciÃ³n
- registro de merma de producciÃ³n
- trazabilidad mÃ­nima operativa

## Alcance que puede quedar para despuÃ©s

- transferencias entre bodegas si el tiempo aprieta
- reportes avanzados
- forecasting
- promociones/combo avanzado
- multiempresa activa real
- integraciones externas

Aunque ojo: **bodegas y lotes no deberÃ­an patearse**, porque si se patean, luego toca rehacer medio modelo. Y eso siempre sale â€œbaratoâ€ hasta que deja de salir barato.
