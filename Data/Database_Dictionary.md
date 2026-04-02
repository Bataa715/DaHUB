# Өгөгдлийн Сангийн Баримт Бичиг (Data Dictionary)

> ClickHouse баазаас шууд үүсгэсэн — **FINACLE**, **ERP**, **EBANK** , **CARDZONE** ,баазуудын хүснэгт, баганын төрөл, тайлбаруудыг агуулна.


---

## 🗄️ `EBANK`

### 📋 `CUSR` (126 багана, 4 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **ACC_FMT** | `Nullable(String)` | Дансны харагдах формат |
| **ACC_VIEW_IND** | `Nullable(String)` | Дансыг харах эрхийн тэмдэглэгээ |
| **AC_MIN_BAL** | `Nullable(Float32)` | Дансанд байлгах хамгийн бага үлдэгдэл |
| **ADM_ID** | `Nullable(String)` | Администраторын дугаар |
| **ALERT_CUST_ID** | `Nullable(String)` | Мэдэгдэл хүлээн авах харилцагчийн дугаар |
| **ALERT_USER_CATEGORY** | `Nullable(String)` | Мэдэгдэл хүлээн авагч хэрэглэгчийн ангилал |
| **AMT_FMT_CD** | `Nullable(String)` | Дүн харуулах форматын код |
| **AUTHENTICATION_MODE** | `Nullable(String)` | Нэвтрэх баталгаажуулалтын горим |
| **AUTHORIZATION_MODE** | `Nullable(String)` | Зөвшөөрөл олгох горим |
| **AUTH_USER** | `Nullable(String)` | Баталгаажуулсан хэрэглэгч |
| **AVAIL_LANG** | `Nullable(String)` | Ашиглах боломжтой хэл |
| **BANK_ID** | `String` | Банкны системийн код |
| **BAY_USER_ID** | `Nullable(String)` | Банкны хэрэглэгчийн дугаар |
| **BRAND_ID** | `Nullable(String)` | Брэндийн дугаар |
| **B_PRIMARY_SOL_ID** | `Nullable(String)` | Үндсэн салбарын дугаар |
| **B_TXNDATE** | `Date` | Гүйлгээний огноо |
| **CAL_TYPE** | `Nullable(String)` | Календарын төрөл |
| **CATEGORY_CODE** | `Nullable(String)` | Ангиллын код |
| **CONCUR_ACCESS_FLG** | `Nullable(String)` | Нэгэн зэрэг нэвтрэхийг зөвшөөрөх эсэх |
| **CORP_USER** | `Nullable(String)` | Байгууллагын хэрэглэгч эсэх |
| **CORP_USER_TYPE** | `Nullable(String)` | Байгууллагын хэрэглэгчийн төрөл |
| **CORRESPONDENCE_ADDRESS** | `Nullable(String)` | Захидал харилцааны хаяг |
| **CP_ENTITY_COUNTER** | `Nullable(Float32)` | CP нэгжийн тоолуур |
| **CRE_USER_SOL** | `Nullable(String)` | Бүртгэл үүсгэсэн хэрэглэгчийн салбар |
| **CUST_ASST_MENU_PRF** | `Nullable(String)` | Харилцагчийн цэсний тохиргоо |
| **CUST_ID** | `Nullable(String)` | Харилцагчийн дугаар |
| **CUST_STATUS** | `Nullable(String)` | Харилцагчийн төлөв |
| **C_ADDR1** | `Nullable(String)` | Хаяг 1 |
| **C_ADDR2** | `Nullable(String)` | Хаяг 2 |
| **C_ADDR3** | `Nullable(String)` | Хаяг 3 |
| **C_CITY** | `Nullable(String)` | Хот |
| **C_CNTRY** | `Nullable(String)` | Улс |
| **C_EMAIL_ID** | `Nullable(String)` | Имэйл хаяг |
| **C_FAX_NO** | `Nullable(String)` | Факс |
| **C_F_NAME** | `Nullable(String)` | Нэр |
| **C_GENDER** | `Nullable(String)` | Хүйс |
| **C_L_NAME** | `Nullable(String)` | Овог |
| **C_M_NAME** | `Nullable(String)` | Дунд нэр |
| **C_M_PHONE_NO** | `Nullable(String)` | Гар утас |
| **C_PHONE_NO** | `Nullable(String)` | Утас |
| **C_RES_STATUS** | `Nullable(String)` | Оршин суух статус |
| **C_STATE** | `Nullable(String)` | Аймаг/муж |
| **C_ZIP** | `Nullable(String)` | Шуудангийн индекс |
| **DB_TS** | `Nullable(Float32)` | Өгөгдлийн сангийн timestamp |
| **DDT_FROM** | `Nullable(Float32)` | Хойшлуулсан дебит эхлэх огноо |
| **DDT_TO** | `Nullable(Float32)` | Хойшлуулсан дебит дуусах огноо |
| **DEFAULT_APPROVER** | `Nullable(String)` | Анхдагч зөвшөөрөгч |
| **DEL_FLG** | `Nullable(String)` | Устгасан эсэх (Y=устгасан) |
| **DIG_SIGN_ENABLED_FLG** | `Nullable(String)` | Дижитал гарын үсэг идэвхтэй эсэх |
| **DIG_SIGN_NO_OF_ATMPTS** | `Nullable(Float32)` | Дижитал гарын үсгийн оролдлогын тоо |
| **DIV_ACC_IND** | `Nullable(String)` | Хуваагддаг данс эсэх |
| **DT_FMT** | `Nullable(String)` | Огнооны формат |
| **D_DR_1FA_LIMIT_AMT** | `Nullable(Float32)` | 1FA зарлагын лимит |
| **D_DR_2FA_LIMIT_AMT** | `Nullable(Float32)` | 2FA зарлагын лимит |
| **EDUCATIONAL_LEVEL** | `Nullable(String)` | Боловсролын түвшин |
| **EXT_ALERT** | `Nullable(String)` | Гадаад мэдэгдэл идэвхтэй эсэх |
| **FORCE_PWD_CHANGE_FLG** | `Nullable(String)` | Нууц үг заавал солих |
| **FORCE_QNA_CHANGE_FLG** | `Nullable(String)` | Нууц асуулт солих |
| **FORCE_TERMS_FLAG** | `Nullable(String)` | Нөхцөл зөвшөөрүүлэх |
| **FORCE_TXN_PASSWORD_CHANGE_FLG** | `Nullable(String)` | Гүйлгээний нууц үг солих |
| **FREE_TEXT_1** | `Nullable(String)` | Чөлөөт текст 1 |
| **FREE_TEXT_2** | `Nullable(String)` | Чөлөөт текст 2 |
| **FREE_TEXT_3** | `Nullable(String)` | Чөлөөт текст 3 |
| **FREE_TEXT_4** | `Nullable(String)` | Чөлөөт текст 4 |
| **INC_RNG_CD** | `Nullable(String)` | Орлогын ангилал |
| **INDIVIDUAL_ID** | `Nullable(String)` | Хувь хүний ID |
| **I_CRE_TIME** | `Nullable(DateTime)` | Анхны бүртгэлийн огноо |
| **I_CRE_USER** | `Nullable(String)` | Анхны бүртгэсэн хэрэглэгч |
| **I_CRE_USER_SOL** | `Nullable(String)` | Анхны салбар |
| **I_STATUS** | `Nullable(String)` | Анхны төлөв |
| **LANG_C_ADDR1** | `Nullable(String)` | Орчуулсан хаяг 1 |
| **LANG_C_ADDR2** | `Nullable(String)` | Орчуулсан хаяг 2 |
| **LANG_C_ADDR3** | `Nullable(String)` | Орчуулсан хаяг 3 |
| **LANG_C_CITY** | `Nullable(String)` | Орчуулсан хот |
| **LANG_C_F_NAME** | `Nullable(String)` | Орчуулсан нэр |
| **LANG_C_L_NAME** | `Nullable(String)` | Орчуулсан овог |
| **LANG_C_M_NAME** | `Nullable(String)` | Орчуулсан дунд нэр |
| **LANG_ID** | `Nullable(String)` | Хэлний код |
| **LIMIT_SCHEME** | `Nullable(String)` | Лимитийн схем |
| **LOC_ACC_IND** | `Nullable(String)` | Байршлын данс эсэх |
| **LOGIN_ALLOWED** | `Nullable(String)` | Нэвтрэх зөвшөөрөл |
| **LOGIN_CERT_MATCH_REQD** | `Nullable(String)` | Сертификат шалгах шаардлага |
| **MARITAL_STATUS** | `Nullable(String)` | Гэрлэлтийн байдал |
| **MENU_PRF** | `Nullable(String)` | Цэсний тохиргоо |
| **MULTI_CRN_TXN_ALLOWED** | `Nullable(String)` | Олон валют зөвшөөрөх |
| **NICK_NAME** | `Nullable(String)` | Хоч нэр |
| **NUM_HOUSEHOLD** | `Nullable(String)` | Өрхийн тоо |
| **OCCUPATION** | `Nullable(String)` | Мэргэжил |
| **ONLINE_REG_PWD** | `Nullable(String)` | Онлайн нууц үг |
| **OOF_FLG** | `Nullable(String)` | Оффисоос гадуур |
| **PAGE_SCHEME** | `Nullable(String)` | Хуудасны схем |
| **PAN_NATIONAL_ID** | `Nullable(String)` | Иргэний бүртгэлийн дугаар |
| **PASSPORT_DETAILS** | `Nullable(String)` | Паспортын мэдээлэл |
| **PASSPORT_NUMBER** | `Nullable(String)` | Паспортын дугаар |
| **PRIM_ACID** | `Nullable(String)` | Үндсэн дансны ID |
| **PRINCIPAL_ID** | `Nullable(String)` | Үндсэн нэгжийн ID |
| **PWD_ENABLED_FLAG** | `Nullable(String)` | Нууц үг идэвхтэй |
| **P_BRANCH_ID** | `Nullable(String)` | Үндсэн салбар |
| **P_DIV_ID** | `Nullable(String)` | Үндсэн хэлтэс |
| **RANGE_LIMIT_SCHEME** | `Nullable(String)` | Хязгаарын схем |
| **RET_AUTH_MODE_PREC** | `Nullable(String)` | Баталгаажуулалтын дараалал |
| **SALUTATION** | `Nullable(String)` | Мэндчилгээ (Ноён гэх мэт) |
| **SCHEME_ID** | `Nullable(String)` | Схем ID |
| **SESSION_ID** | `Nullable(String)` | Session ID |
| **SMS_ALERT** | `Nullable(String)` | SMS мэдэгдэл |
| **SMS_NO_OF_ATMPTS** | `Nullable(Float32)` | SMS оролдлого |
| **S_CRE_TIME** | `Nullable(DateTime)` | 2 дахь бүртгэл |
| **S_CRE_USER** | `Nullable(String)` | 2 дахь хэрэглэгч |
| **S_CRE_USER_SOL** | `Nullable(String)` | 2 дахь салбар |
| **S_STATUS** | `Nullable(String)` | 2 дахь төлөв |
| **TOT_NUM_LOGIN** | `Nullable(Float32)` | Нэвтрэлтийн тоо |
| **TRANSACTION_ALLOWED** | `Nullable(String)` | Гүйлгээ зөвшөөрөх |
| **TRAN_AUTH_SCHEME** | `Nullable(String)` | Гүйлгээний схем |
| **TXN_CERT_MATCH_REQD** | `Nullable(String)` | Сертификат шаардлагатай |
| **TXN_LIMIT** | `Nullable(Float32)` | Гүйлгээний лимит |
| **TXN_LMT_CURRENCY** | `Nullable(String)` | Лимитийн валют |
| **T_CRE_TIME** | `Nullable(DateTime)` | 3 дахь бүртгэл |
| **T_CRE_USER** | `Nullable(String)` | 3 дахь хэрэглэгч |
| **T_CRE_USER_SOL** | `Nullable(String)` | 3 дахь салбар |
| **T_STATUS** | `Nullable(String)` | 3 дахь төлөв |
| **USER_ALERT_REGISTRATION_FLAG** | `Nullable(String)` | Alert бүртгэлтэй эсэх |
| **USER_TXN_TYPES** | `Nullable(String)` | Зөвшөөрөгдсөн гүйлгээ |
| **USER_TYPE** | `Nullable(String)` | Хэрэглэгчийн төрөл |
| **USR_INT_CD** | `Nullable(String)` | Дотоод код |
| **VIRTUAL_USER_FLG** | `Nullable(String)` | Виртуал хэрэглэгч |
| **WF_RULE_SELECT_AUTH** | `Nullable(String)` | Workflow баталгаажуулалт |


<br>


## 🗄️ `ERP`

### 📋 `EMPLOYEE_HISTORY` (19 багана, 12 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **B_TXNDATE** | `Nullable(Date)` | Гүйлгээний огноо |
| **CIF_ID** | `Nullable(String)` | Харилцагчийн давтагдашгүй дугаар (CIF) |
| **CURRENT_STATUS_ID** | `Nullable(Float64)` | Одоогийн статусын дугаар |
| **DEPARTMENT_ID** | `Nullable(Float64)` | Газар / хэлтсийн дугаар |
| **DEPARTMENT_NAME** | `Nullable(String)` | Газар / хэлтсийн нэр |
| **EMPLOYEE_CODE** | `Nullable(String)` | Ажилтны код |
| **EMPLOYEE_ID** | `Nullable(Float64)` | Ажилтны системийн дугаар |
| **ERANK** | `Nullable(Float64)` | Ажилтны гадаад зэрэглэл |
| **GENDER** | `Nullable(String)` | Хүйс |
| **NAME_PATH** | `Nullable(String)` | Байгууллагын бүтцийн нэршлийн зам |
| **POSITION_ID** | `Nullable(Float64)` | Албан тушаалын дугаар |
| **POSITION_KEY_ID** | `Nullable(Float64)` | Албан тушаалын түлхүүр дугаар |
| **POSITION_NAME** | `Nullable(String)` | Албан тушаалын нэр |
| **SOL_ID** | `Nullable(String)` | Салбарын код |
| **SRANK** | `Nullable(Float64)` | Ажилтны системийн зэрэглэл |
| **STATE_REG_NUMBER** | `Nullable(String)` | Регистрийн дугаар |
| **STATUS_ID** | `Nullable(Float64)` | Статусын дугаар |
| **WORK_END_DATE** | `Nullable(Date)` | Ажил дууссан огноо |
| **WORK_START_DATE** | `Nullable(Date)` | Ажилд орсон огноо |


<br>


### 📋 `ERP_EMPLOYEE` (65 багана, 10 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **BIRTH_COUNTRY_ID** | `Nullable(Float64)` | Төрсөн улсын дугаар |
| **BIRTH_ORDER_ID** | `Nullable(Float64)` | Төрсөн дарааллын дугаар |
| **BIRTH_PLACE** | `Nullable(String)` | Төрсөн газар |
| **BLOOD_TYPE_ID** | `Nullable(Float64)` | Цусны бүлгийн дугаар |
| **CITY_ID** | `Nullable(Float64)` | Хотын дугаар |
| **COUNTRY_ID** | `Nullable(Float64)` | Улсын дугаар |
| **CREATED_DATE** | `Nullable(DateTime)` | Бүртгэл үүсгэсэн огноо, цаг |
| **CREATED_USER_ID** | `Nullable(Float64)` | Бүртгэл үүсгэсэн хэрэглэгчийн дугаар |
| **CURRENT_STATUS_ID** | `Nullable(Float64)` | Одоогийн статусын дугаар |
| **CURRENT_WORKED_MONTH** | `Nullable(Float64)` | Одоогийн байдлаарх нийт ажилласан сар |
| **CUSTOMER_ID** | `Nullable(Float64)` | Банкны систем дэх харилцагчийн дугаар |
| **DATE_OF_BIRTH** | `Nullable(Date)` | Төрсөн огноо |
| **DEPARTMENT_ID** | `Nullable(Float64)` | Газар / хэлтсийн дугаар |
| **DESCRIPTION** | `Nullable(String)` | Нэмэлт тайлбар |
| **DISABILITY_PERCENT** | `Nullable(Float64)` | Хөгжлийн бэрхшээлийн хувь |
| **DISTRICT_ID** | `Nullable(Float64)` | Дүүрэг / сумын дугаар |
| **DRIVE_ID** | `Nullable(Float64)` | Жолооны үнэмлэхийн дугаар |
| **DRIVE_START_YEAR_ID** | `Nullable(Float64)` | Жолоо барьж эхэлсэн жилийн дугаар |
| **EDUCATION_LEVEL** | `Nullable(String)` | Боловсролын түвшин |
| **EMPLOYEE_CODE** | `Nullable(String)` | Ажилтны код |
| **EMPLOYEE_EMAIL** | `Nullable(String)` | Ажилтны и-мэйл хаяг |
| **EMPLOYEE_ID** | `Float64` | Ажилтны системийн дугаар |
| **EMPLOYEE_INDEX** | `Nullable(String)` | Ажилтны индекс дугаар |
| **EMPLOYEE_MAIL2** | `Nullable(String)` | Ажилтны нэмэлт и-мэйл хаяг |
| **EMPLOYEE_MOBILE** | `Nullable(String)` | Ажилтны гар утасны дугаар |
| **EMPLOYEE_PHONE** | `Nullable(String)` | Ажилтны утасны дугаар |
| **FACEBOOK_ID** | `Nullable(String)` | Facebook хаяг |
| **FAX** | `Nullable(String)` | Факсын дугаар |
| **FIRST_NAME** | `Nullable(String)` | Нэр |
| **FIRST_NAME_ENG** | `Nullable(String)` | Нэр (англиар) |
| **GENDER** | `Nullable(String)` | Хүйс |
| **HEIGHT** | `Nullable(Float64)` | Өндөр (см) |
| **INITIAL_WORKED_MONTH** | `Nullable(Float64)` | Анхны бүртгэл дэх нийт ажилласан сар |
| **IS_ACTIVE** | `Nullable(Float64)` | Идэвхтэй эсэх (`1` = идэвхтэй) |
| **IS_DRIVER** | `Nullable(Float64)` | Жолооч эсэх |
| **IS_IMPORT** | `Nullable(Float64)` | Импортоор орж ирсэн эсэх |
| **IS_MEMBER_LABORER_UNION** | `Nullable(Float64)` | Үйлдвэрчний эвлэлийн гишүүн эсэх |
| **KEY_START_DATE** | `Nullable(Date)` | Түлхүүр огнооны эхлэх хугацаа |
| **LAST_NAME** | `Nullable(String)` | Овог |
| **LAST_NAME_ENG** | `Nullable(String)` | Овог (англиар) |
| **LUNAR_SIGN_ID** | `Nullable(Float64)` | Билгийн тооллын тэмдгийн дугаар |
| **MARITAL_STATUS_ID** | `Nullable(Float64)` | Гэр бүлийн байдлын дугаар |
| **MEDICAL_INSURANCE_NUMBER** | `Nullable(String)` | Эрүүл мэндийн даатгалын дугаар |
| **MILITARY_CARD_NUMBER** | `Nullable(String)` | Цэргийн үүргийн үнэмлэхийн дугаар |
| **NO_OF_CHILDREN** | `Nullable(Float64)` | Хүүхдийн тоо |
| **NO_OF_FAMILY_MEMBER** | `Nullable(Float64)` | Өрхийн гишүүдийн тоо |
| **ORIGIN_ID** | `Nullable(Float64)` | Гарал угсааны дугаар |
| **PERSON_ID** | `Float64` | Хувь хүний бүртгэлийн үндсэн дугаар |
| **POSITION_FIELD_ID** | `Nullable(Float64)` | Албан тушаалын чиглэлийн дугаар |
| **POSITION_KEY_ID** | `Nullable(Float64)` | Албан тушаалын түлхүүр дугаар |
| **POST_ADDRESS** | `Nullable(String)` | Шуудангийн хаяг |
| **PROFESSION_ID** | `Nullable(Float64)` | Мэргэжлийн дугаар |
| **PURPOSE** | `Nullable(String)` | Зорилго / нэмэлт тайлбар |
| **SALARY_LEVEL_ID** | `Nullable(Float64)` | Цалингийн түвшний дугаар |
| **SOCIAL_INSURANCE_NUMBER** | `Nullable(String)` | Нийгмийн даатгалын дугаар |
| **SOCIAL_ORIGIN_ID** | `Nullable(Float64)` | Нийгмийн гаралтай холбоотой дугаар |
| **SOL_ID** | `Nullable(String)` | Салбарын код |
| **STATE_REG_NUMBER** | `Nullable(String)` | Регистрийн дугаар |
| **STATE_REG_NUMBER_ENG** | `Nullable(String)` | Регистрийн дугаар (англи бичвэрээр) |
| **STATUS_NAME** | `Nullable(String)` | Статусын нэр |
| **TEMP_DESCRIPTION** | `Nullable(String)` | Түр тайлбар |
| **TITLE** | `Nullable(String)` | Цол / хаяглалтын нэр |
| **URAG** | `Nullable(String)` | Ураг овог |
| **WORK_START_DATE** | `Date` | Ажилд орсон огноо |
| **ZODIAC_SIGN_ID** | `Nullable(Float64)` | Зурхайн ордын дугаар |


<br>


### 📋 `ERP_EMPLOYEE_KEY` (29 багана, 6 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **CREATED_DATE** | `Nullable(DateTime)` | Бүртгэл үүсгэсэн огноо, цаг |
| **CREATED_USER_ID** | `Nullable(Float64)` | Бүртгэл үүсгэсэн хэрэглэгчийн дугаар |
| **CURRENCY_ID** | `Nullable(Float64)` | Валютын дугаар |
| **CURRENT_STATUS_ID** | `Nullable(Float64)` | Одоогийн статусын дугаар |
| **DEPARTMENT_ID** | `Nullable(Float64)` | Газар / хэлтсийн дугаар |
| **EMPLOYEE_CODE** | `Nullable(String)` | Ажилтны код |
| **EMPLOYEE_ID** | `Nullable(Float64)` | Ажилтны системийн дугаар |
| **EMPLOYEE_KEY_ID** | `Nullable(Float64)` | Ажилтны түлхүүр дугаар |
| **EMPLOYEE_METADATA_ID** | `Nullable(Float64)` | Ажилтны мета өгөгдлийн дугаар |
| **INSURED_TYPE_ID** | `Nullable(Float64)` | Даатгалын төрлийн дугаар |
| **IS_ACTIVE** | `Nullable(Float64)` | Идэвхтэй эсэх (`1` = идэвхтэй) |
| **IS_PAYING_ND** | `Nullable(Float64)` | Нийгмийн даатгал төлдөг эсэх |
| **IS_SALARY_PERCENT** | `Nullable(Float64)` | Цалин хувиар тооцогддог эсэх |
| **MODIFIED_DATE** | `Nullable(DateTime)` | Сүүлд өөрчилсөн огноо, цаг |
| **MODIFIED_USER_ID** | `Nullable(Float64)` | Сүүлд өөрчилсөн хэрэглэгчийн дугаар |
| **POSITION_KEY_ID** | `Nullable(Float64)` | Албан тушаалын түлхүүр дугаар |
| **RECTORSHIP_ID** | `Nullable(Float64)` | Тушаалын дугаар |
| **RECTORSHIP_NUMBER** | `Nullable(String)` | Тушаалын дугаарлалт |
| **SALARY** | `Nullable(String)` | Цалин |
| **SALARY1** | `Nullable(String)` | Үндсэн цалин |
| **SALARY_EXTRA** | `Nullable(String)` | Нэмэгдэл цалин |
| **SALARY_KEY_ID** | `Nullable(Float64)` | Цалингийн түлхүүр дугаар |
| **SALARY_LEVEL_ID** | `Nullable(Float64)` | Цалингийн түвшний дугаар |
| **SALARY_PERCENT** | `Nullable(Float64)` | Цалингийн хувь |
| **SALARY_SUBLEVEL_ID** | `Nullable(Float64)` | Цалингийн дэд түвшний дугаар |
| **SALARY_TYPE_ID** | `Nullable(Float64)` | Цалингийн төрлийн дугаар |
| **STATUS_ID** | `Nullable(Float64)` | Статусын дугаар |
| **WORK_END_DATE** | `Nullable(Date)` | Ажил дууссан огноо |
| **WORK_START_DATE** | `Nullable(Date)` | Ажилд орсон огноо |


<br>


### 📋 `ERP_HR_CURRENT_STATUS` (5 багана, 1 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **B_TXNDATE** | `Date` | Гүйлгээний огноо |
| **CODE** | `Nullable(String)` | Статусын код |
| **ID** | `Nullable(Float64)` | Статусын дугаар |
| **KEY_ACTIVE** | `Nullable(Float64)` | Түлхүүр идэвхтэй эсэх тэмдэглэгээ |
| **NAME** | `Nullable(String)` | Статусын нэр |


<br>


### 📋 `ERP_HR_POSITION` (27 багана, 4 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **BI_TO_CLICK_DATE** | `Date` | BI системээс ClickHouse руу шилжүүлсэн огноо |
| **CLASSIFICATION_ID** | `Nullable(Float32)` | Ангиллын дугаар |
| **CREATED_DATE** | `Nullable(DateTime)` | Бүртгэл үүсгэсэн огноо, цаг |
| **CREATED_USER_ID** | `Nullable(Float32)` | Бүртгэл үүсгэсэн хэрэглэгчийн дугаар |
| **DEPARTMENT_ID** | `Nullable(Float32)` | Газар / хэлтсийн дугаар |
| **DESCRIPTION** | `Nullable(String)` | Нэмэлт тайлбар |
| **DISPLAY_ORDER** | `Nullable(Float32)` | Дэлгэцэнд харагдах дараалал |
| **END_DATE** | `Nullable(Date)` | Дуусах огноо |
| **FIELD_ID** | `Nullable(Float32)` | Чиглэлийн дугаар |
| **GLOBE_CODE** | `Nullable(String)` | Globe системийн код |
| **GROUP_ID** | `Nullable(Float32)` | Бүлгийн дугаар |
| **IS_ACTIVE** | `Nullable(Float32)` | Идэвхтэй эсэх (`1` = идэвхтэй) |
| **IS_IMPORT** | `Nullable(Float32)` | Импортоор орж ирсэн эсэх |
| **MODIFIED_DATE** | `Nullable(DateTime)` | Сүүлд өөрчилсөн огноо, цаг |
| **MODIFIED_USER_ID** | `Nullable(Float32)` | Сүүлд өөрчилсөн хэрэглэгчийн дугаар |
| **POSITION_CODE** | `Nullable(String)` | Албан тушаалын код |
| **POSITION_ID** | `Float32` | Албан тушаалын дугаар |
| **POSITION_KEY_ID** | `Nullable(Float64)` | Албан тушаалын түлхүүр дугаар |
| **POSITION_NAME** | `Nullable(String)` | Албан тушаалын нэр |
| **POSITION_NAME_EN** | `Nullable(String)` | Албан тушаалын нэр (англиар) |
| **PROF_LEVEL_ID** | `Nullable(Float32)` | Мэргэжлийн зэрэглэлийн дугаар |
| **SALARY_TYPE_ID** | `Nullable(Float32)` | Цалингийн төрлийн дугаар |
| **SHORT_NAME** | `Nullable(String)` | Товчилсон нэр |
| **START_DATE** | `Nullable(Date)` | Эхлэх огноо |
| **TYPE_ID** | `Nullable(Float32)` | Төрлийн дугаар |
| **VERSION_NUMBER** | `Nullable(Float32)` | Хувилбарын дугаар |
| **VOCATION_GROUP_ID** | `Nullable(Float32)` | Мэргэжлийн бүлгийн дугаар |


<br>


### 📋 `HR_ORG_DEPARTMENT` (36 багана, 4 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **CHANNEL_ID** | `Nullable(Float64)` | Сувгийн дугаар |
| **CLASSIFICATION_ID** | `Nullable(Float64)` | Ангиллын дугаар |
| **COMPANY_ID** | `Nullable(Float64)` | Компанийн дугаар |
| **COORDINATE** | `Nullable(String)` | Газарзүйн солбицол |
| **CREATED_DATE** | `Nullable(DateTime)` | Бүртгэл үүсгэсэн огноо, цаг |
| **CREATED_USER_ID** | `Nullable(Float64)` | Бүртгэл үүсгэсэн хэрэглэгчийн дугаар |
| **CUSTOMER_ID** | `Nullable(Float64)` | Харилцагчийн дугаар |
| **DEPARTMENT_CODE** | `Nullable(String)` | Хэлтсийн код |
| **DEPARTMENT_ID** | `Float64` | Газар / хэлтсийн дугаар |
| **DEPARTMENT_NAME** | `Nullable(String)` | Газар / хэлтсийн нэр |
| **DEPARTMENT_NAME_EN** | `Nullable(String)` | Хэлтсийн нэр (англиар) |
| **DEPENDENCY_DEPARTMENT_ID** | `Nullable(Float64)` | Харьяалагдах дээд хэлтсийн дугаар |
| **DIRECTOR_PROF_LEVEL_ID** | `Nullable(Float64)` | Удирдах ажилтны мэргэжлийн зэрэглэлийн дугаар |
| **DISPLAY_ORDER** | `Nullable(Float64)` | Дэлгэцэнд харагдах дараалал |
| **END_DATE** | `Nullable(Date)` | Дуусах огноо |
| **GLOBE_CODE** | `Nullable(String)` | Globe системийн код |
| **HIER_ORDER** | `Nullable(String)` | Байгууллагын шатлалын дараалал |
| **IS_ACTIVE** | `Nullable(Float64)` | Идэвхтэй эсэх (`1` = идэвхтэй) |
| **IS_IMPORT** | `Nullable(Float64)` | Импортоор орж ирсэн эсэх |
| **MODIFIED_DATE** | `Nullable(DateTime)` | Сүүлд өөрчилсөн огноо, цаг |
| **MODIFIED_USER_ID** | `Nullable(Float64)` | Сүүлд өөрчилсөн хэрэглэгчийн дугаар |
| **NAME_PATH** | `Nullable(String)` | Байгууллагын бүтцийн нэршлийн зам |
| **OBJECT_PHOTO** | `Nullable(String)` | Байгууллагын зураг |
| **PARENT_ID** | `Nullable(Float64)` | Дээд нэгжийн дугаар |
| **SALARY_PERCENT** | `Nullable(Float64)` | Цалингийн хувь |
| **SEGMENT_ID** | `Nullable(Float64)` | Сегментийн дугаар |
| **SOL_ID** | `Nullable(String)` | Салбарын код |
| **START_DATE** | `Nullable(Date)` | Эхлэх огноо |
| **STATUS_ID** | `Nullable(Float64)` | Статусын дугаар |
| **SYSTEM_URL** | `Nullable(String)` | Системийн URL хаяг |
| **TYPE_ID** | `Nullable(Float64)` | Төрлийн дугаар |
| **VERSION_NUMBER** | `Nullable(Float64)` | Хувилбарын дугаар |
| **WFM_DESCRIPTION** | `Nullable(String)` | Ажлын хүчний удирдлагын тайлбар |
| **WFM_STATUS_ID** | `Nullable(Float64)` | WFM статусын дугаар |
| **WFM_WORKFLOW_ID** | `Nullable(Float64)` | WFM ажлын урсгалын дугаар |
| **WSDL_URL** | `Nullable(String)` | Вэб үйлчилгээний WSDL хаяг |


<br>


### 📋 `TNA_TIME_ATTENDANCE` (18 багана, 3 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **ACCESS_TYPE_ID** | `Nullable(Float64)` | Орох / гарах төрлийн дугаар |
| **ATTENDANCE** | `Nullable(String)` | Ирцийн төлөв |
| **ATTENDANCE_DATE_TIME** | `Nullable(DateTime)` | Ирц бүртгэсэн огноо, цаг |
| **ATTENDANCE_ID** | `Nullable(Float64)` | Ирцийн бүртгэлийн дугаар |
| **COMPANY_DEPARTMENT_ID** | `Nullable(Float64)` | Компанийн хэлтсийн дугаар |
| **COORDINATE** | `Nullable(String)` | GPS солбицол |
| **CREATED_DATE** | `Nullable(DateTime)` | Бүртгэл үүсгэсэн огноо, цаг |
| **CREATED_USER_ID** | `Nullable(Float64)` | Бүртгэл үүсгэсэн хэрэглэгчийн дугаар |
| **DESCRIPTION** | `Nullable(String)` | Нэмэлт тайлбар |
| **EMPLOYEE_ID** | `Nullable(Float64)` | Ажилтны системийн дугаар |
| **EMPLOYEE_KEY_ID** | `Nullable(Float64)` | Ажилтны түлхүүр дугаар |
| **ID** | `Nullable(Float64)` | Бичлэгийн дугаар |
| **IMPORT_ID** | `Nullable(Float64)` | Импортын дугаар |
| **IS_REMOVED_NOT_PLAN** | `Nullable(Float64)` | Төлөвлөгөөнөөс хасагдсан эсэх |
| **MODIFIED_DATE** | `Nullable(DateTime)` | Сүүлд өөрчилсөн огноо, цаг |
| **MODIFIED_USER_ID** | `Nullable(Float64)` | Сүүлд өөрчилсөн хэрэглэгчийн дугаар |
| **POST_DATE_TIME** | `Nullable(DateTime)` | Бичлэг оруулсан огноо, цаг |
| **TERMINAL_ID** | `Nullable(Float64)` | Ирцийн терминалын дугаар |


<br>


## 🗄️ `FINACLE`

### 📋 `AAS` (52 багана, 10 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **ACCT_POA_AS_AMT_ALWD** | `Nullable(Float64)` | Эрх олгогчид зөвшөөрөгдсөн дүн |
| **ACCT_POA_AS_DESIG** | `Nullable(String)` | Эрх олгогчийн албан тушаал / тодорхойлолт |
| **ACCT_POA_AS_NAME** | `Nullable(String)` | Эрх олгогчийн нэр |
| **ACCT_POA_AS_REC_TYPE** | `Nullable(String)` | Эрх олгогчийн бүртгэлийн төрөл |
| **ACCT_POA_AS_RMKS** | `Nullable(String)` | Эрх олгогчийн тайлбар |
| **ACCT_POA_AS_SRL_NUM** | `Nullable(String)` | Эрх олгогчийн дарааллын дугаар |
| **ACID** | `String` | Дансны дотоод дугаар (ACID) |
| **ALT1_ACCT_POA_AS_NAME** | `Nullable(String)` | Эрх олгогчийн нэмэлт нэр |
| **BANK_ID** | `Nullable(String)` | Банкны системийн код |
| **B_REGISTER** | `Nullable(String)` | Хоёр дахь бүртгэлийн тэмдэглэгээ |
| **CUST_EMAIL_TYPE** | `Nullable(String)` | Харилцагчийн и-мэйлийн төрөл |
| **CUST_ID** | `Nullable(String)` | Харилцагчийн код |
| **CUST_PHONE_TYPE** | `Nullable(String)` | Харилцагчийн утасны төрөл |
| **CUST_RELTN_CODE** | `Nullable(String)` | Харилцагчийн хамаарлын код |
| **DEL_FLG** | `Nullable(String)` | Устгасан эсэхийн тэмдэглэгээ (`Y` = устгасан) |
| **FA_CNTRY_CODE** | `Nullable(String)` | FA улсын код |
| **FA_FREE_CODE1** | `Nullable(String)` | FA чөлөөт код 1 |
| **FA_FREE_CODE2** | `Nullable(String)` | FA чөлөөт код 2 |
| **FA_FREE_TEXT** | `Nullable(String)` | FA чөлөөт текст |
| **FA_LAST_REVIEW_DATE** | `Nullable(DateTime)` | FA сүүлийн хяналтын огноо |
| **FA_NEXT_REVIEW_DATE** | `Nullable(DateTime)` | FA дараагийн хяналтын огноо |
| **FA_REPORT_STAT** | `Nullable(String)` | FA тайлангийн төлөв |
| **FA_TAX_REPORTABLE** | `Nullable(String)` | FA татварын тайлагнал шаардлагатай эсэх |
| **FA_WTAX_PCNT** | `Nullable(Float64)` | FA татварын хувь |
| **FORACID** | `Nullable(String)` | Дансны гадаад дугаар (харилцагчид харагдах дугаар) |
| **GUARANTOR_LIAB_PCNT** | `Nullable(Float64)` | Батлан даагчийн хариуцах хувь |
| **GUARANTOR_LIAB_SEQ** | `Nullable(String)` | Батлан даагчийн дараалал |
| **INTCERT_PRINT_FLG** | `Nullable(String)` | Хүүгийн сертификат хэвлэх эсэх тэмдэглэгээ |
| **INTRADAY_STMNT_REQD** | `Nullable(String)` | Өдрийн дотор хуулга шаардлагатай эсэх |
| **INT_ADV_FLG** | `Nullable(String)` | Хүүгийн урьдчилгаа холбоотой тэмдэглэгээ |
| **LCHG_TIME** | `Nullable(DateTime)` | Сүүлд өөрчилсөн огноо, цаг |
| **LCHG_USER_ID** | `Nullable(String)` | Сүүлд өөрчилсөн хэрэглэгчийн дугаар |
| **LOAN_OVRDUE_FLG** | `Nullable(String)` | Зээл хугацаа хэтэрсэн эсэх тэмдэглэгээ |
| **MODE_OF_DESPATCH** | `Nullable(String)` | Хуулга илгээх арга |
| **NMA_KEY_ID** | `Nullable(String)` | NMA түлхүүрийн дугаар |
| **NMA_KEY_TYPE** | `Nullable(String)` | NMA түлхүүрийн төрөл |
| **PASS_SHEET_FLG** | `Nullable(String)` | Хадгаламжийн дэвтэртэй эсэх тэмдэглэгээ |
| **PHONE** | `Nullable(String)` | Утасны дугаар |
| **PREF_LANG_ACCT_POA_AS_RMKS** | `Nullable(String)` | Илүүд үзэх хэл дээрх эрх олгогчийн тайлбар |
| **PREF_LANG_CODE** | `Nullable(String)` | Илүүд үзэх хэлний код |
| **PROFIT_CERT_FLG** | `Nullable(String)` | Ашгийн сертификаттай холбоотой тэмдэглэгээ |
| **RCRE_TIME** | `Nullable(DateTime)` | Бүртгэсэн огноо, цаг |
| **RCRE_USER_ID** | `Nullable(String)` | Бүртгэсэн хэрэглэгчийн дугаар |
| **RELATED_PARTY_TYPE** | `Nullable(String)` | Холбоотой талын төрөл |
| **RELATED_SOL** | `Nullable(Float64)` | Холбоотой салбарын дугаар |
| **SCHM_TYPE** | `Nullable(String)` | Бүтээгдэхүүний төрөл (`SB` = хадгаламж, `CA` = харилцах гэх мэт) |
| **SI_FLG** | `Nullable(String)` | Байнгын заавартай эсэх тэмдэглэгээ |
| **START_DATE** | `DateTime` | Эхлэх огноо, цаг |
| **STMT_CUST_ID** | `Nullable(String)` | Хуулга хүлээн авах харилцагчийн дугаар |
| **TD_MATRTY_FLG** | `Nullable(String)` | Хугацаат хадгаламжийн хугацаа дуусахтай холбоотой тэмдэглэгээ |
| **TS_CNT** | `Nullable(Float64)` | Цагийн тэмдэглэлийн тоолуур |
| **XCLUDE_FOR_COMB_STMT** | `Nullable(String)` | Нэгдсэн хуулгад оруулахгүй эсэх тэмдэглэгээ |


<br>


### 📋 `ACCOUNTS` (233 багана, 7 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **ACCESSASSIGNEEAGENT** | `Nullable(UInt32)` | Хандалт хуваарилагдсан агентын дугаар |
| **ACCESSOWNERAGENT** | `Nullable(UInt32)` | Хандалтын эзэмшигч агентын дугаар |
| **ACCESSOWNERBC** | `Nullable(UInt32)` | Хандалтын эзэмшигч бизнес нэгжийн дугаар |
| **ACCESSOWNERGROUP** | `Nullable(UInt32)` | Хандалтын эзэмшигч бүлгийн дугаар |
| **ACCESSOWNERSEGMENT** | `Nullable(String)` | Хандалтын эзэмшигчийн сегмент |
| **ACCOUNTID** | `UInt32` | Дансны системийн үндсэн дугаар |
| **ADDRESS_LINE1** | `Nullable(String)` | Хаяг 1 |
| **ADDRESS_LINE2** | `Nullable(String)` | Хаяг 2 |
| **ADDRESS_LINE3** | `Nullable(String)` | Хаяг 3 |
| **ALERT1** | `Nullable(String)` | Мэдэгдлийн утга 1 |
| **ALREADYCREATEDINEBANKING** | `Nullable(String)` | И-банкинд бүртгэгдсэн эсэх |
| **AMOUNT1** | `Nullable(UInt8)` | Дүн 1 |
| **ASSIGNEDTO** | `Nullable(UInt32)` | Хариуцуулсан хэрэглэгчийн дугаар |
| **ASSIGNEDTOGROUP** | `Nullable(String)` | Хариуцуулсан бүлгийн нэр |
| **AUTOAPPROVAL** | `Nullable(String)` | Автоматаар зөвшөөрөх эсэх тэмдэглэгээ |
| **BIRTH_DAY** | `Nullable(UInt8)` | Төрсөн өдөр |
| **BIRTH_MONTH** | `Nullable(String)` | Төрсөн сар |
| **BIRTH_YEAR** | `Nullable(UInt16)` | Төрсөн жил |
| **BLACKLISTED** | `Nullable(String)` | Хар жагсаалтад орсон эсэх тэмдэглэгээ |
| **BOCREATEDBY** | `Nullable(UInt32)` | Back-office дээр бүртгэсэн хэрэглэгчийн дугаар |
| **BODATECREATED** | `Date` | Back-office дээр бүртгэсэн огноо |
| **BODATEMODIFIED** | `Nullable(DateTime64(3))` | Back-office дээр сүүлд өөрчилсөн огноо |
| **BOMODIFIEDBY** | `Nullable(UInt32)` | Back-office дээр сүүлд өөрчилсөн хэрэглэгчийн дугаар |
| **B_ANNUAL_OTHERS_INCOME** | `Nullable(Int64)` | Жилийн бусад орлого |
| **B_ANNUAL_RENTAL_INCOME** | `Nullable(Int64)` | Жилийн түрээсийн орлого |
| **B_ANNUAL_SALARY_INCOME** | `Nullable(Float64)` | Жилийн цалингийн орлого |
| **B_ANNUAL_STOCK_BOND_INCOME** | `Nullable(Int64)` | Жилийн хувьцаа, бондын орлого |
| **B_ANNUAL_TOTAL_INCOME** | `Nullable(Float64)` | Жилийн нийт орлого |
| **B_AVERAGE_ANNUALINCOME** | `Nullable(UInt64)` | Жилийн дундаж орлого |
| **B_DATE_OF_INCORPORATION** | `Nullable(Date32)` | Байгууллага үүсгэн байгуулагдсан огноо |
| **B_DOS_CODE** | `Nullable(String)` | DOS код |
| **B_DOS_TYPE** | `Nullable(String)` | DOS төрөл |
| **B_EDU_DET** | `Nullable(String)` | Боловсролын дэлгэрэнгүй мэдээлэл |
| **B_EMPLOYERID** | `Nullable(String)` | Ажил олгогчийн дугаар |
| **B_EMPLOYER_NAME** | `Nullable(String)` | Ажил олгогчийн нэр |
| **B_EMPLOYMENT_STATUS** | `Nullable(String)` | Ажил эрхлэлтийн төлөв |
| **B_EMPLOYMENT_STATUS_TEXT** | `Nullable(String)` | Ажил эрхлэлтийн төлөвийн тайлбар |
| **B_MARITAL_STATUS** | `Nullable(String)` | Гэр бүлийн байдал |
| **B_NATIONALITY** | `Nullable(String)` | Иргэний харьяалал |
| **B_OCCUPATION** | `Nullable(String)` | Мэргэжил / ажил |
| **B_REGISTRATION_NUMBER** | `Nullable(String)` | Бүртгэлийн дугаар |
| **B_RELATIONSHIP_STARTDATE** | `Nullable(DateTime64(3))` | Харилцаа эхэлсэн огноо |
| **B_SALOTHERINCOME3** | `Nullable(UInt32)` | Бусад орлого 3 |
| **B_SEGCODE** | `Nullable(String)` | Сегментийн код |
| **B_SEGMENT** | `Nullable(String)` | Харилцагчийн сегмент |
| **B_STATE_REGISTRATION** | `Nullable(String)` | Улсын бүртгэлийн дугаар |
| **B_STATUS** | `Nullable(String)` | Бичлэгийн төлөв |
| **B_SUBSECTOR** | `Nullable(String)` | Дэд салбар |
| **CARD_HOLDER** | `Nullable(String)` | Карт эзэмшигчийн нэр |
| **CITY** | `Nullable(String)` | Хот |
| **CONCURDETECT_X** | `Nullable(UInt16)` | Нэгэн зэрэг нэвтрэлт илрүүлэх тоолуур |
| **CONVERTED_DATE** | `Nullable(DateTime64(3))` | Хөрвүүлсэн огноо |
| **CORPREPCOUNT** | `Nullable(Int16)` | Байгууллагын төлөөлөгчдийн тоо |
| **CORP_ID** | `Nullable(UInt32)` | Байгууллагын дугаар |
| **COUNTRY** | `Nullable(String)` | Улс |
| **CREATEDBYSYSTEMID** | `Nullable(String)` | Үүсгэсэн системийн дугаар |
| **CREATEDLOCATIONID** | `Nullable(UInt32)` | Үүсгэсэн байршлын дугаар |
| **CREATEDUSERID** | `Nullable(UInt32)` | Үүсгэсэн хэрэглэгчийн дугаар |
| **CREATED_FROM** | `Nullable(String)` | Үүссэн суваг |
| **CRNCY_CODE** | `Nullable(String)` | Валютын код (`MNT`, `USD` гэх мэт) |
| **CURRSTEPDUEDATE** | `Nullable(DateTime64(3))` | Одоогийн алхмын дуусах огноо |
| **CUSTCREATIONMODE** | `Nullable(String)` | Харилцагч бүртгэсэн арга / горим |
| **CUSTOMERMINOR** | `Nullable(String)` | Насанд хүрээгүй эсэх тэмдэглэгээ |
| **CUSTOMERNREFLG** | `Nullable(String)` | NRE харилцагч эсэх тэмдэглэгээ |
| **CUSTOMER_LEVEL_PROVISIONING** | `Nullable(String)` | Харилцагчийн түвшний нөөцийн тэмдэглэгээ |
| **CUST_COMMUNITY** | `Nullable(String)` | Харилцагчийн нийгмийн бүлэг / хамт олон |
| **CUST_COMMU_CODE** | `Nullable(String)` | Харилцагчийн нийгмийн бүлгийн код |
| **CUST_DOB** | `Nullable(DateTime64(3))` | Харилцагчийн төрсөн огноо |
| **CUST_FIRST_NAME** | `Nullable(String)` | Харилцагчийн нэр |
| **CUST_HLTH** | `Nullable(String)` | Харилцагчийн эрүүл мэндийн байдал |
| **CUST_ID** | `String` | Харилцагчийн код |
| **CUST_LANGUAGE** | `Nullable(String)` | Харилцагчийн хэл |
| **CUST_LAST_NAME** | `Nullable(String)` | Харилцагчийн овог |
| **CUST_MIDDLE_NAME** | `Nullable(String)` | Харилцагчийн дунд нэр |
| **CUST_SWIFT_CODE_DESC** | `Nullable(String)` | SWIFT кодын тайлбар |
| **CUST_TYPE** | `Nullable(String)` | Харилцагчийн төрөл |
| **CUST_TYPE_CODE** | `Nullable(String)` | Харилцагчийн төрлийн код |
| **DATEOFBECOMINGNRE** | `Nullable(DateTime64(3))` | NRE болсон огноо |
| **DEFAULTADDRESSTYPE** | `Nullable(String)` | Анхдагч хаягийн төрөл |
| **DEFAULTCHANNEL_ALERT** | `Nullable(String)` | Анхдагч мэдэгдлийн суваг |
| **DESIGNATION** | `Nullable(String)` | Албан тушаал / тодорхойлолт |
| **DOCUMENT_RECEIVED** | `Nullable(String)` | Баримт бичиг хүлээн авсан эсэх |
| **DTDATE8** | `Nullable(DateTime64(3))` | Нэмэлт огноо 8 |
| **DTDATE9** | `Nullable(DateTime64(3))` | Нэмэлт огноо 9 |
| **DUEDATE** | `Nullable(DateTime64(3))` | Дуусах огноо |
| **EDITEDLOCATIONID** | `Nullable(UInt32)` | Засвар хийсэн байршлын дугаар |
| **EDUCATION** | `Nullable(String)` | Боловсрол |
| **EMAIL** | `Nullable(String)` | И-мэйл хаяг |
| **EMAIL_HOME** | `Nullable(String)` | Хувийн и-мэйл |
| **EMAIL_PALM** | `Nullable(String)` | Гар утасны и-мэйл |
| **ENABLE_ALERTS** | `Nullable(String)` | Мэдэгдэл идэвхтэй эсэх тэмдэглэгээ |
| **ESC_DUE_TIME** | `Nullable(DateTime64(3))` | Дамжуулалтын хугацааны цаг |
| **EXTENSION** | `Nullable(String)` | Дотуур утасны дугаар |
| **FATCAREMARKS** | `Nullable(String)` | FATCA тайлбар |
| **FAX** | `Nullable(String)` | Факсын дугаар |
| **FLG1** | `Nullable(String)` | Тэмдэглэгээ 1 |
| **FOREIGNACCTAXREPORTINGREQ** | `Nullable(String)` | Гадаад татварын тайлагнал шаардлагатай эсэх |
| **FOREIGNTAXREPORTINGCOUNTRY** | `Nullable(String)` | Гадаад татварын тайлагналын улс |
| **FOREIGNTAXREPORTINGSTATUS** | `Nullable(String)` | Гадаад татварын тайлагналын төлөв |
| **GENDER** | `Nullable(String)` | Хүйс |
| **GROUPID** | `Nullable(String)` | Бүлгийн дугаар |
| **GROUPID_CODE** | `Nullable(String)` | Бүлгийн код |
| **HSHLDUFLAG** | `Nullable(String)` | Өрхийн нэгжийн тэмдэглэгээ |
| **IDTYPER1** | `Nullable(String)` | Иргэний баримт бичгийн төрөл 1 |
| **IDTYPER2** | `Nullable(String)` | Иргэний баримт бичгийн төрөл 2 |
| **INCREMENTALDATE** | `Nullable(DateTime64(3))` | Нэмэлт шинэчлэлтийн огноо |
| **INDUSTRY** | `Nullable(String)` | Үйлдвэрлэл / салбар |
| **INTROD_CUST_ID** | `Nullable(String)` | Танилцуулсан харилцагчийн дугаар |
| **INTUSERFIELD1** | `Nullable(UInt8)` | Тоон хэрэглэгчийн нэмэлт талбар 1 |
| **ISCORPREP** | `Nullable(String)` | Байгууллагын төлөөлөгч эсэх тэмдэглэгээ |
| **ISDUMMY** | `Nullable(String)` | Туршилтын бичлэг эсэх тэмдэглэгээ |
| **ISEBANKINGENABLED** | `Nullable(String)` | И-банкинг идэвхтэй эсэх |
| **ISLAMIC_BANKING_CUSTOMER** | `Nullable(String)` | Исламын банкны харилцагч эсэх |
| **ISMCEDITED** | `Nullable(String)` | MC дээр засвар хийгдсэн эсэх |
| **ISSMSBANKINGENABLED** | `Nullable(String)` | SMS банкинг идэвхтэй эсэх |
| **ISTAMPERED** | `Nullable(String)` | Өөрчлөлт орсон эсэх тэмдэглэгээ |
| **ISWAPBANKINGENABLED** | `Nullable(String)` | WAP банкинг идэвхтэй эсэх |
| **IS_SWIFT_CODE_OF_BANK** | `Nullable(String)` | Банкны SWIFT код эсэх тэмдэглэгээ |
| **LASTEDITEDPAGE** | `Nullable(String)` | Сүүлд засвар хийсэн хуудас |
| **LASTFOREIGNTAXREVIEWDATE** | `Nullable(DateTime64(3))` | Гадаад татварын сүүлийн хяналтын огноо |
| **LASTOPERPERFORMED** | `Nullable(String)` | Сүүлд хийсэн үйлдэл |
| **LASTSUBMITTEDDATE** | `Nullable(DateTime64(3))` | Сүүлд илгээсэн огноо |
| **MAIDENNAMEOFMOTHER** | `Nullable(String)` | Эхийн төрсөн овог |
| **MANAGER** | `String` | Менежерийн дугаар |
| **MINORATTAINMAJORDATE** | `Nullable(DateTime64(3))` | Насанд хүрэх огноо |
| **MINOR_GUARD_CODE** | `Nullable(String)` | Асран хамгаалагчийн код |
| **MINOR_GUARD_NAME** | `Nullable(String)` | Асран хамгаалагчийн нэр |
| **MLUSERFIELD7** | `Nullable(String)` | Олон хэлний хэрэглэгчийн талбар 7 |
| **MLUSERFIELD8** | `Nullable(String)` | Олон хэлний хэрэглэгчийн талбар 8 |
| **MLUSERFIELD9** | `Nullable(String)` | Олон хэлний хэрэглэгчийн талбар 9 |
| **NAME** | `Nullable(String)` | Харилцагчийн нэр |
| **NATIVELANGCODE** | `Nullable(String)` | Эх хэлний код |
| **NATIVELANGNAME** | `Nullable(String)` | Эх хэлний нэр |
| **NAT_ID_CARD_NUM** | `Nullable(String)` | Иргэний үнэмлэх / үндэсний бүртгэлийн картын дугаар |
| **NEGATED** | `Nullable(String)` | Хүчингүй болгосон эсэх тэмдэглэгээ |
| **NEGATED_NOTES** | `Nullable(String)` | Хүчингүй болгосон тайлбар |
| **NEXTFOREIGNTAXREVIEWDATE** | `Nullable(DateTime64(3))` | Дараагийн гадаад татварын хяналтын огноо |
| **OCCUPATION** | `Nullable(String)` | Мэргэжил / ажил эрхлэлт |
| **OFFLINE_CUM_DEBIT_LIMIT** | `Nullable(UInt8)` | Офлайн хуримтлагдсан зарлагын дээд хязгаар |
| **OLDENTITYCREATEDON** | `Nullable(DateTime64(3))` | Хуучин нэгжийн үүссэн огноо |
| **OLDENTITYID** | `Nullable(String)` | Хуучин нэгжийн дугаар |
| **OLDENTITYTYPE** | `Nullable(String)` | Хуучин нэгжийн төрөл |
| **ORGKEY** | `String` | Харилцагчийн давтагдашгүй системийн түлхүүр |
| **ORGTYPE** | `Nullable(String)` | Байгууллагын төрөл |
| **OTUOLDCIFID** | `Nullable(String)` | Хуучин CIF дугаар |
| **OWNEDUSERID** | `Nullable(UInt32)` | Эзэмшигч хэрэглэгчийн дугаар |
| **PASSPORTNO** | `Nullable(String)` | Паспортын дугаар |
| **PERSONTYPE** | `Nullable(String)` | Хүний төрөл |
| **PHONE** | `Nullable(String)` | Утасны дугаар |
| **PHONE_CELL** | `Nullable(String)` | Гар утасны дугаар |
| **PHONE_HOME** | `Nullable(String)` | Гэрийн утас |
| **PHONE_HOME2** | `Nullable(String)` | Гэрийн утас 2 |
| **PHYSICAL_STATE** | `Nullable(String)` | Биеийн ерөнхий байдал |
| **PLACEOFBIRTH** | `Nullable(String)` | Төрсөн газар |
| **PREFERREDCALENDAR** | `Nullable(String)` | Илүүд үздэг хуанли |
| **PREFERREDCHANNELID** | `Nullable(UInt8)` | Илүүд үздэг сувгийн дугаар |
| **PREFERREDEMAIL** | `Nullable(String)` | Илүүд үздэг и-мэйл |
| **PREFERREDEMAILTYPE** | `Nullable(String)` | Илүүд үздэг и-мэйлийн төрөл |
| **PREFERREDNAME** | `Nullable(String)` | Илүүд үздэг нэр |
| **PREFERREDPHONE** | `Nullable(String)` | Илүүд үздэг утас |
| **PREFERREDPHONETYPE** | `Nullable(String)` | Илүүд үздэг утасны төрөл |
| **PREFERRED_MOBILE_ALERT_NO** | `Nullable(String)` | Илүүд үздэг гар утасны мэдэгдлийн дугаар |
| **PREFERRED_MOBILE_ALERT_TYPE** | `Nullable(String)` | Гар утасны мэдэгдлийн төрөл |
| **PRIMARY_SOL_ID** | `Nullable(String)` | Үндсэн салбарын дугаар |
| **PRIORITYCODE** | `Nullable(String)` | Тэргүүлэх ач холбогдлын код |
| **PROCESSGROUPID** | `Nullable(UInt32)` | Процессын бүлгийн дугаар |
| **PROCESSID** | `Nullable(UInt32)` | Процессын дугаар |
| **PSPRT_EXP_DATE** | `Nullable(DateTime64(3))` | Паспортын хүчинтэй хугацаа дуусах огноо |
| **PSPRT_ISSUE_DATE** | `Nullable(DateTime64(3))` | Паспорт олгосон огноо |
| **PURGEFLAG** | `Nullable(String)` | Бичлэгийг устгах тэмдэглэгээ |
| **PURGEREMARKS** | `Nullable(String)` | Устгалын тайлбар |
| **RATING** | `Nullable(String)` | Харилцагчийн үнэлгээ |
| **RATINGDATE** | `Nullable(DateTime64(3))` | Үнэлгээ өгсөн огноо |
| **RECORDSTATUS** | `Nullable(String)` | Бичлэгийн төлөв |
| **REGION** | `Nullable(String)` | Бүс нутаг |
| **RELATIONSHIPCREATEDBYID** | `Nullable(UInt32)` | Харилцаа бүртгэсэн хэрэглэгчийн дугаар |
| **RELATIONSHIPMGRID** | `Nullable(UInt32)` | Харилцааны менежерийн дугаар |
| **RELATIONSHIPOPENINGDATE** | `Nullable(DateTime64(3))` | Харилцаа нээсэн огноо |
| **SALUTATION** | `Nullable(String)` | Хүндэтгэлийн хандлага / мэндчилгээ |
| **SALUTATION_CODE** | `Nullable(String)` | Мэндчилгээний код |
| **SECONDARYRM_ID** | `Nullable(String)` | Хоёрдогч харилцааны менежерийн дугаар |
| **SECTOR** | `Nullable(String)` | Эдийн засгийн салбар |
| **SECTOR_CODE** | `Nullable(String)` | Салбарын код |
| **SEGMENTATION_CLASS** | `Nullable(String)` | Сегментийн ангилал |
| **SENCITIZENAPPLICABLEDATE** | `Nullable(DateTime64(3))` | Ахмад настанд хамаарах огноо |
| **SENCITIZENCONVERSIONFLAG** | `Nullable(String)` | Ахмад настан болсон эсэх тэмдэглэгээ |
| **SENIORCITIZEN** | `Nullable(String)` | Ахмад настан эсэх тэмдэглэгээ |
| **SHORT_NAME** | `Nullable(String)` | Товч нэр |
| **SLALEVEL** | `Nullable(String)` | SLA түвшин |
| **SMSBANKINGMOBILENUMBER** | `Nullable(String)` | SMS банкингийн гар утасны дугаар |
| **STAFFEMPLOYEEID** | `Nullable(String)` | Ажилтны дугаар |
| **STAFFFLAG** | `Nullable(String)` | Банкны ажилтан эсэх тэмдэглэгээ |
| **STARTDATE** | `Nullable(DateTime64(3))` | Эхлэх огноо |
| **STATE** | `Nullable(String)` | Аймаг / муж |
| **STATUS** | `Nullable(String)` | Төлөв |
| **STATUS_CODE** | `Nullable(String)` | Төлөвийн код |
| **STRFIELD10** | `Nullable(String)` | Текст талбар 10 |
| **STRFIELD11** | `Nullable(String)` | Текст талбар 11 |
| **STRFIELD12** | `Nullable(String)` | Текст талбар 12 |
| **STRFIELD13** | `Nullable(String)` | Текст талбар 13 |
| **STRFIELD14** | `Nullable(String)` | Текст талбар 14 |
| **STRFIELD15** | `Nullable(String)` | Текст талбар 15 |
| **STRFIELD16** | `Nullable(String)` | Текст талбар 16 |
| **STRFIELD17** | `Nullable(String)` | Текст талбар 17 |
| **STRFIELD20** | `Nullable(String)` | Текст талбар 20 |
| **STRFIELD4** | `Nullable(String)` | Текст талбар 4 |
| **STRFIELD8** | `Nullable(String)` | Текст талбар 8 |
| **STRFIELD9** | `Nullable(String)` | Текст талбар 9 |
| **STRUSERFIELD18** | `Nullable(String)` | Хэрэглэгчийн текст талбар 18 |
| **STRUSERFIELD2** | `Nullable(String)` | Хэрэглэгчийн текст талбар 2 |
| **STRUSERFIELD28** | `Nullable(String)` | Хэрэглэгчийн текст талбар 28 |
| **STRUSERFIELD29** | `Nullable(String)` | Хэрэглэгчийн текст талбар 29 |
| **STRUSERFIELD30** | `Nullable(String)` | Хэрэглэгчийн текст талбар 30 |
| **STRUSERFIELD4** | `Nullable(String)` | Хэрэглэгчийн текст талбар 4 |
| **STRUSERFIELD6** | `Nullable(String)` | Хэрэглэгчийн текст талбар 6 |
| **STRUSERFIELD7** | `Nullable(String)` | Хэрэглэгчийн текст талбар 7 |
| **SUBSECTOR** | `Nullable(String)` | Дэд салбар |
| **SUBSECTOR_CODE** | `Nullable(String)` | Дэд салбарын код |
| **SUBSEGMENT** | `Nullable(String)` | Дэд сегмент |
| **SUSPENDED** | `Nullable(String)` | Түдгэлзүүлсэн эсэх тэмдэглэгээ |
| **SUSPEND_NOTES** | `Nullable(String)` | Түдгэлзүүлсэн тайлбар |
| **TABVALIDATOR** | `Nullable(String)` | Хуудасны баталгаажуулагч |
| **TATDURATION** | `Nullable(String)` | TAT хугацааны үргэлжлэх хугацаа |
| **TDS_CIFID** | `Nullable(String)` | TDS систем дэх CIF дугаар |
| **TDS_CUST_ID** | `Nullable(String)` | TDS систем дэх харилцагчийн дугаар |
| **TDS_TBL** | `Nullable(String)` | TDS хүснэгтийн нэр |
| **TDS_TBL_CODE** | `Nullable(String)` | TDS хүснэгтийн код |
| **TFPARTYFLAG** | `Nullable(String)` | Гуравдагч этгээд эсэх тэмдэглэгээ |
| **TMDATE** | `Nullable(DateTime64(3))` | Цагийн тэмдэгийн огноо |
| **UNIQUEID** | `Nullable(String)` | Давтагдашгүй дугаар |
| **UNIQUEIDNUMBER** | `Nullable(String)` | Давтагдашгүй дугаарын утга |
| **UNIQUEIDTYPE** | `Nullable(String)` | Давтагдашгүй дугаарын төрөл |
| **ZIP** | `Nullable(String)` | Шуудангийн индекс |


<br>


### 📋 `CVD` (19 багана, 15 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **ACID** | `Nullable(String)` | Дансны дотоод дугаар (ACID) |
| **BANK_ID** | `Nullable(String)` | Банкны системийн код |
| **B_TXNDATE** | `Nullable(DateTime)` | Гүйлгээний огноо, цаг |
| **DEL_FLG** | `Nullable(String)` | Устгасан эсэхийн тэмдэглэгээ (`Y` = устгасан) |
| **LCHG_TIME** | `Nullable(DateTime)` | Сүүлд өөрчилсөн огноо, цаг |
| **LCHG_USER_ID** | `Nullable(String)` | Сүүлд өөрчилсөн хэрэглэгчийн дугаар |
| **LIMIT_B2KID** | `Nullable(String)` | B2K хязгаарлалтын дугаар |
| **RCRE_TIME** | `Nullable(DateTime)` | Бүртгэсэн огноо, цаг |
| **RCRE_USER_ID** | `Nullable(String)` | Бүртгэсэн хэрэглэгчийн дугаар |
| **SECU_CODE** | `Nullable(String)` | Барьцааны код |
| **SECU_LINKAGE_TYPE** | `Nullable(String)` | Барьцааны холболтын төрөл |
| **SECU_SRL_NUM** | `Nullable(String)` | Барьцааны дарааллын дугаар |
| **TABLE_TYPE** | `Nullable(String)` | Хүснэгтийн төрөл |
| **TS_CNT** | `Nullable(Float32)` | Цагийн тэмдэглэлийн тоолуур |
| **VEHICLE_CHASSIS_NUM** | `Nullable(String)` | Тээврийн хэрэгслийн арлын дугаар |
| **VEHICLE_ENGINE_NUM** | `Nullable(String)` | Тээврийн хэрэгслийн хөдөлгүүрийн дугаар |
| **VEHICLE_MODEL** | `Nullable(String)` | Тээврийн хэрэгслийн загвар |
| **VEHICLE_OWNER_NAME** | `Nullable(String)` | Тээврийн хэрэгслийн эзэмшигчийн нэр |
| **VEHICLE_REGN_NUM** | `Nullable(String)` | Тээврийн хэрэгслийн улсын дугаар |


<br>


### 📋 `GAC` (19 багана, 10 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **B_FREE_CODE_1_NAME** | `Nullable(String)` | Чөлөөт код 1-ийн нэр |
| **B_FREE_CODE_3_NAME** | `Nullable(String)` | Чөлөөт код 3-ын нэр |
| **B_PURPOSE_GROUPNAME** | `Nullable(String)` | Зориулалтын бүлгийн нэр |
| **G_ACCT_OCCP_CODE** | `Nullable(String)` | Дансны эзэмшлийн ангиллын код |
| **G_ACID** | `String` | Дансны дотоод дугаар |
| **G_BORROWER_CATEGORY_CODE** | `Nullable(String)` | Зээлдэгчийн ангиллын код |
| **G_FREE_CODE_1** | `Nullable(String)` | Чөлөөт код 1 |
| **G_FREE_CODE_2** | `Nullable(String)` | Чөлөөт код 2 |
| **G_FREE_CODE_3** | `Nullable(String)` | Чөлөөт код 3 |
| **G_FREE_CODE_4** | `Nullable(String)` | Чөлөөт код 4 |
| **G_FREE_TEXT_15** | `Nullable(String)` | Чөлөөт текст 15 |
| **G_INDUSTRY_TYPE** | `Nullable(String)` | Үйл ажиллагааны салбарын төрөл |
| **G_LCHG_TIME** | `Nullable(DateTime)` | Сүүлд өөрчилсөн огноо, цаг |
| **G_LCHG_USER_ID** | `Nullable(String)` | Сүүлд өөрчилсөн хэрэглэгчийн дугаар |
| **G_PD_FLG** | `Nullable(String)` | Хугацаа хэтэрсэн эсэхийн тэмдэглэгээ |
| **G_RCRE_TIME** | `Date` | Бүртгэсэн огноо |
| **G_RCRE_USER_ID** | `Nullable(String)` | Бүртгэсэн хэрэглэгчийн дугаар |
| **G_SECTOR_CODE** | `Nullable(String)` | Салбарын код |
| **G_TS_CNT** | `Nullable(Float32)` | Цагийн тэмдэглэлийн тоолуур |


<br>


### 📋 `GAM_ACCOUNTS` (59 багана, 19 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **ACCT_CLASSIFICATION_FLG** | `Nullable(String)` | Данс ангилагдсан эсэхийн тэмдэглэгээ |
| **ACCT_CLS_DATE** | `Nullable(Date)` | Данс хаагдсан огноо |
| **ACCT_CLS_FLG** | `Nullable(String)` | Данс хаагдсан эсэхийн тэмдэглэгээ (`Y` = тийм) |
| **ACCT_CRNCY_CODE** | `Nullable(String)` | Дансны валютын код |
| **ACCT_LOCN_CODE** | `Nullable(String)` | Дансны байршлын код |
| **ACCT_NAME** | `Nullable(String)` | Дансны нэр |
| **ACCT_NUM** | `Nullable(String)` | Дансны дугаар |
| **ACCT_OPN_DATE** | `Date` | Данс нээсэн огноо |
| **ACCT_OWNERSHIP** | `Nullable(String)` | Данс эзэмшлийн хэлбэр |
| **ACCT_PREFIX** | `Nullable(String)` | Дансны угтвар код |
| **ACCT_RPT_CODE** | `Nullable(String)` | Дансны тайлангийн код |
| **ACCT_SHORT_NAME** | `Nullable(String)` | Дансны товчилсон нэр |
| **ACCT_TURNOVER_DET_FLG** | `Nullable(String)` | Дансны эргэлтийн дэлгэрэнгүй мэдээлэлтэй эсэх тэмдэглэгээ |
| **ACID** | `String` | Дансны дотоод дугаар (ACID) |
| **ACRD_CR_AMT** | `Nullable(Float32)` | Хуримтлагдсан кредит дүн |
| **BACID** | `Nullable(String)` | Балансын дансны дотоод дугаар |
| **BAL_ON_PURGE_DATE** | `Nullable(Float32)` | Устгал хийсэн өдрийн үлдэгдэл |
| **CIF_ID** | `Nullable(String)` | Харилцагчийн давтагдашгүй дугаар (CIF) |
| **CLR_BAL_AMT** | `Nullable(Float32)` | Боломжит үлдэгдэл |
| **CONS_BAL_FLG** | `Nullable(String)` | Нэгдсэн үлдэгдэлтэй эсэх тэмдэглэгээ |
| **CRNCY_CODE** | `Nullable(String)` | Валютын код (`MNT`, `USD` гэх мэт) |
| **CUM_CR_AMT** | `Nullable(Float32)` | Нийт хуримтлагдсан кредит дүн |
| **CUM_DR_AMT** | `Nullable(Float32)` | Нийт хуримтлагдсан дебит дүн |
| **CUST_ID** | `Nullable(String)` | Харилцагчийн код |
| **DEL_FLG** | `Nullable(String)` | Устгасан эсэхийн тэмдэглэгээ (`Y` = устгасан) |
| **DR_BAL_LIM** | `Nullable(Float32)` | Дебит үлдэгдлийн хязгаар |
| **DR_INT_METHOD** | `Nullable(String)` | Дебит хүү тооцох арга |
| **EMP_ID** | `Nullable(String)` | Ажилтны дугаар |
| **ENTITY_CRE_FLG** | `Nullable(String)` | Нэгж үүсгэсэн эсэхийн тэмдэглэгээ |
| **FORACID** | `Nullable(String)` | Дансны гадаад дугаар (харилцагчид харагдах дугаар) |
| **FREE_TEXT** | `Nullable(String)` | Чөлөөт текст |
| **FREZ_CODE** | `Nullable(String)` | Хөлдөлтийн код |
| **FREZ_REASON_CODE** | `Nullable(String)` | Хөлдөлтийн шалтгааны код |
| **GL_SUB_HEAD_CODE** | `Nullable(String)` | GL дэд толгойн код |
| **HASHED_NO** | `Nullable(String)` | Хамгаалагдсан хэш дугаар |
| **IBAN_NUMBER** | `Nullable(String)` | IBAN дугаар |
| **INT_COLL_FLG** | `Nullable(String)` | Хүү цуглуулах эсэхийн тэмдэглэгээ |
| **INT_PAID_FLG** | `Nullable(String)` | Хүү төлөгдсөн эсэхийн тэмдэглэгээ |
| **LAST_ANY_TRAN_DATE** | `Nullable(Date)` | Сүүлд ямар нэгэн гүйлгээ хийгдсэн огноо |
| **LAST_MODIFIED_DATE** | `Nullable(Date)` | Сүүлд өөрчилсөн огноо |
| **LAST_PURGE_DATE** | `Nullable(Date)` | Сүүлд устгал хийсэн огноо |
| **LAST_TRAN_DATE** | `Nullable(Date)` | Сүүлийн гүйлгээний огноо |
| **LAST_TRAN_DATE_CR** | `Nullable(Date)` | Сүүлийн кредит гүйлгээний огноо |
| **LAST_TRAN_DATE_DR** | `Nullable(Date)` | Сүүлийн дебит гүйлгээний огноо |
| **LAST_TRAN_ID_CR** | `Nullable(String)` | Сүүлийн кредит гүйлгээний дугаар |
| **LAST_TRAN_ID_DR** | `Nullable(String)` | Сүүлийн дебит гүйлгээний дугаар |
| **LCHG_TIME** | `Nullable(DateTime)` | Сүүлд өөрчилсөн огноо, цаг |
| **LCHG_USER_ID** | `Nullable(String)` | Сүүлд өөрчилсөн хэрэглэгчийн дугаар |
| **LIEN_AMT** | `Nullable(Float32)` | Барьцаалсан дүн |
| **LIMIT_B2KID** | `Nullable(String)` | B2K хязгаарлалтын дугаар |
| **MODE_OF_OPER_CODE** | `Nullable(String)` | Ажиллагааны горимын код |
| **NOM_AVAILABLE_FLG** | `Nullable(String)` | Нэр дэвшигчийн мэдээлэл бүртгэлтэй эсэх тэмдэглэгээ |
| **PB_PS_CODE** | `Nullable(String)` | PB/PS код |
| **RCRE_TIME** | `Nullable(DateTime)` | Бүртгэсэн огноо, цаг |
| **RCRE_USER_ID** | `Nullable(String)` | Бүртгэсэн хэрэглэгчийн дугаар |
| **SCHM_CODE** | `Nullable(String)` | Бүтээгдэхүүний код (Scheme Code) |
| **SERV_CHRG_COLL_FLG** | `Nullable(String)` | Үйлчилгээний шимтгэл цуглуулах эсэх тэмдэглэгээ |
| **SOL_ID** | `Nullable(String)` | Салбарын код |
| **TS_CNT** | `Nullable(Float32)` | Цагийн тэмдэглэлийн тоолуур |


<br>


### 📋 `GAM_LAM` (102 багана, 22 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **B_ACCRBINT** | `Nullable(Float32)` | Хуримтлагдсан үндсэн хүү |
| **B_ACCRCINT** | `Nullable(Float32)` | Хуримтлагдсан нэмэгдэл хүү |
| **B_ACCRFINT** | `Nullable(Float32)` | Хуримтлагдсан торгуулийн хүү |
| **B_ADJBINT** | `Nullable(Float32)` | Тохируулсан үндсэн хүү |
| **B_ADJCINT** | `Nullable(Float32)` | Тохируулсан нэмэгдэл хүү |
| **B_ADJFINT** | `Nullable(Float32)` | Тохируулсан торгуулийн хүү |
| **B_ADVDATE** | `Nullable(Date)` | Зээлийн гэрээний огноо |
| **B_APPROVDATE** | `Nullable(Date)` | Зээлийг зөвшөөрсөн огноо |
| **B_ASSET_CONTROL_FLG** | `Nullable(String)` | Хөрөнгийн хяналттай эсэх тэмдэглэгээ |
| **B_BALANCE** | `Nullable(Float32)` | Зээлийн үлдэгдэл |
| **B_CAPBINT** | `Nullable(Float32)` | Капиталжуулсан үндсэн хүү |
| **B_CAPCINT** | `Nullable(Float32)` | Капиталжуулсан нэмэгдэл хүү |
| **B_CAPFINT** | `Nullable(Float32)` | Капиталжуулсан торгуулийн хүү |
| **B_CHRGE_OFF_DATE** | `Nullable(Date)` | Зардалд шилжүүлсэн огноо |
| **B_DAILYBINT** | `Nullable(Float32)` | Өдөр тутмын үндсэн хүү |
| **B_DAILYCINT** | `Nullable(Float32)` | Өдөр тутмын нэмэгдэл хүү |
| **B_DAILYFINT** | `Nullable(Float32)` | Өдөр тутмын торгуулийн хүү |
| **B_DPD_CNTR** | `Nullable(Float32)` | Хугацаа хэтэрсэн хоногийн тоо |
| **B_FULL_RATE** | `Nullable(Float32)` | Нийт хүүгийн хувь |
| **B_INTRATE** | `Nullable(Float32)` | Хүүгийн хувь |
| **B_INTRATE_FUNC** | `Nullable(Float32)` | Функциональ хүүгийн хувь |
| **B_INT_DMD_OS** | `Nullable(Float32)` | Төлөгдөх ёстой хүүгийн үлдэгдэл |
| **B_INT_DMD_OS_DATE** | `Nullable(Date)` | Хүү нэхэмжилсэн огноо |
| **B_MAIN_CLASSIFICATION** | `Nullable(String)` | Үндсэн ангилал |
| **B_MAIN_CLASS_SYSTEM** | `Nullable(String)` | Системийн үндсэн ангилал |
| **B_NEXT_PAY_DATE** | `Nullable(Date)` | Дараагийн төлбөрийн огноо |
| **B_PENAL_DMD_OS_DATE** | `Nullable(Date)` | Торгууль нэхэмжилсэн огноо |
| **B_PNL_DMD_OS** | `Nullable(Float32)` | Төлөгдөх ёстой торгуулийн үлдэгдэл |
| **B_PRIN_DMD_OS** | `Nullable(Float32)` | Төлөгдөх ёстой үндсэн зээлийн үлдэгдэл |
| **B_PRIN_DMD_OS_DATE** | `Nullable(Date)` | Үндсэн төлбөр нэхэмжилсэн огноо |
| **B_RATE** | `Nullable(Float32)` | Гүйлгээний ханш |
| **B_SECU_VALUE** | `Nullable(Float32)` | Барьцааны үнэлгээ |
| **B_SECU_VALUE_MNT** | `Nullable(Float32)` | Барьцааны төгрөгөөр илэрхийлсэн үнэлгээ |
| **B_SEGCODE** | `Nullable(String)` | Сегментийн код |
| **B_START_SCHDL_DATE** | `Nullable(Date)` | Төлбөрийн хуваарийн эхлэх огноо |
| **B_SUB_CLASSIFICATION** | `Nullable(String)` | Дэд ангилал |
| **B_SUB_CLASS_SYSTEM** | `Nullable(String)` | Системийн дэд ангилал |
| **B_SYSTEM_CLASSIFICATION_DATE** | `Nullable(Date)` | Системийн ангилал тогтоосон огноо |
| **B_TXNADV** | `Nullable(Float32)` | Гүйлгээний урьдчилгаа |
| **B_TXNBAL** | `Nullable(Float32)` | Гүйлгээний үлдэгдэл |
| **B_TXNDATE** | `Date` | Гүйлгээний огноо |
| **B_TXNDAY** | `Nullable(Float32)` | Гүйлгээ хийгдсэн хоногийн тоо |
| **B_USER_CLASSIFICATION_DATE** | `Nullable(Date)` | Хэрэглэгчийн ангилал тогтоосон огноо |
| **G_ACCT_CLS_DATE** | `Nullable(Date)` | Данс хаагдсан огноо |
| **G_ACCT_CLS_FLG** | `Nullable(String)` | Данс хаагдсан эсэхийн тэмдэглэгээ (`Y` = тийм) |
| **G_ACCT_CRNCY_CODE** | `Nullable(String)` | Дансны валютын код |
| **G_ACCT_MGR_USER_ID** | `Nullable(String)` | Дансны менежерийн хэрэглэгчийн дугаар |
| **G_ACCT_MOD_FLG** | `Nullable(String)` | Данс өөрчлөгдсөн эсэхийн тэмдэглэгээ |
| **G_ACCT_NAME** | `Nullable(String)` | Дансны нэр |
| **G_ACCT_OPN_DATE** | `Date` | Данс нээсэн огноо |
| **G_ACCT_OWNERSHIP** | `Nullable(String)` | Данс эзэмшлийн хэлбэр |
| **G_ACCT_RPT_CODE** | `Nullable(String)` | Дансны тайлангийн код |
| **G_ACCT_SHORT_NAME** | `Nullable(String)` | Дансны товчилсон нэр |
| **G_CIF_ID** | `Nullable(String)` | Харилцагчийн CIF дугаар |
| **G_CLR_BAL_AMT** | `Nullable(Float32)` | Боломжит үлдэгдэл |
| **G_CRNCY_CODE** | `Nullable(String)` | Дансны валютын код |
| **G_CUST_ID** | `Nullable(String)` | Харилцагчийн код |
| **G_DEL_FLG** | `Nullable(String)` | Устгасан эсэхийн тэмдэглэгээ |
| **G_DRWNG_POWER** | `Nullable(Float32)` | Зээл ашиглах боломжит хязгаар |
| **G_EMP_ID** | `Nullable(String)` | Ажилтны дугаар |
| **G_FORACID** | `Nullable(String)` | Дансны гадаад дугаар |
| **G_FREE_TEXT** | `Nullable(String)` | Чөлөөт текст |
| **G_FREZ_REASON_CODE** | `Nullable(String)` | Хөлдөлтийн шалтгааны код |
| **G_GL_SUB_HEAD_CODE** | `Nullable(String)` | GL дэд толгойн код |
| **G_LAST_MODIFIED_DATE** | `Nullable(Date)` | Сүүлд өөрчилсөн огноо |
| **G_LAST_TRAN_DATE** | `Nullable(Date)` | Сүүлд гүйлгээ хийсэн огноо |
| **G_LAST_TRAN_DATE_CR** | `Nullable(Date)` | Сүүлийн кредит гүйлгээний огноо |
| **G_LAST_TRAN_DATE_DR** | `Nullable(Date)` | Сүүлийн дебит гүйлгээний огноо |
| **G_LAST_TRAN_ID_CR** | `Nullable(String)` | Сүүлийн кредит гүйлгээний дугаар |
| **G_LAST_TRAN_ID_DR** | `Nullable(String)` | Сүүлийн дебит гүйлгээний дугаар |
| **G_LCHG_TIME** | `Nullable(Date)` | Сүүлд өөрчилсөн огноо |
| **G_LCHG_USER_ID** | `Nullable(String)` | Сүүлд өөрчилсөн хэрэглэгчийн дугаар |
| **G_LIEN_AMT** | `Nullable(Float32)` | Барьцаалсан дүн |
| **G_LIMIT_B2KID** | `Nullable(String)` | Зээлийн хязгаарын код |
| **G_OPERATIVE_ACID** | `Nullable(String)` | Үйл ажиллагааны дансны дотоод дугаар |
| **G_PHONE_NUM** | `Nullable(String)` | Утасны дугаар |
| **G_RCRE_TIME** | `Nullable(Date)` | Бүртгэсэн огноо |
| **G_RCRE_USER_ID** | `Nullable(String)` | Бүртгэсэн хэрэглэгчийн дугаар |
| **G_SCHM_CODE** | `Nullable(String)` | Бүтээгдэхүүний код |
| **G_SCHM_SUB_TYPE** | `Nullable(String)` | Бүтээгдэхүүний дэд төрөл |
| **G_SOL_ID** | `Nullable(String)` | Салбарын код |
| **L_CHRGE_OFF_FLG** | `Nullable(String)` | Зардалд шилжүүлсэн эсэхийн тэмдэглэгээ |
| **L_DEL_FLG** | `Nullable(String)` | Устгасан эсэхийн тэмдэглэгээ |
| **L_DIS_AMT** | `Nullable(Float32)` | Хөнгөлөлтийн дүн |
| **L_EI_PERD_END_DATE** | `Nullable(Date)` | Хүүгийн чөлөөт хугацааны дуусах огноо |
| **L_EI_PERD_START_DATE** | `Nullable(Date)` | Хүүгийн чөлөөт хугацааны эхлэх огноо |
| **L_EMPLOYER_ID** | `Nullable(String)` | Ажил олгогчийн дугаар |
| **L_INT_DMD_OS** | `Nullable(Float32)` | Төлөгдөх ёстой хүүгийн үлдэгдэл |
| **L_LAST_PRIN_DMD_DATE** | `Nullable(Date)` | Сүүлд үндсэн төлбөр нэхэмжилсэн огноо |
| **L_LCHG_TIME** | `Nullable(Date)` | Сүүлд өөрчилсөн огноо |
| **L_LCHG_USER_ID** | `Nullable(String)` | Сүүлд өөрчилсөн хэрэглэгчийн дугаар |
| **L_OP_ACID** | `Nullable(String)` | Үйл ажиллагааны дансны дугаар |
| **L_PAST_DUE_FLG** | `Nullable(String)` | Хугацаа хэтэрсэн эсэхийн тэмдэглэгээ |
| **L_PAYOFF_FLG** | `Nullable(String)` | Бүрэн төлөгдсөн эсэхийн тэмдэглэгээ |
| **L_PRIN_DMD_OS** | `Nullable(Float32)` | Төлөгдөх ёстой үндсэн зээлийн үлдэгдэл |
| **L_RCRE_TIME** | `Nullable(Date)` | Үүсгэсэн огноо |
| **L_RCRE_USER_ID** | `Nullable(String)` | Үүсгэсэн хэрэглэгчийн дугаар |
| **L_REP_PERD_DAYS** | `Nullable(Float32)` | Эргэн төлөх хугацаа (хоногоор) |
| **L_REP_PERD_MTHS** | `Nullable(Float32)` | Эргэн төлөх хугацаа (сараар) |
| **L_RESHDL_OVERDUE_INT** | `Nullable(Float32)` | Хугацаа хэтэрсэн хүүгийн дахин хуваарьлалт |
| **L_SEC_STATUS_FLG** | `Nullable(String)` | Барьцааны төлөвийн тэмдэглэгээ |
| **_ACID** | `String` | Дансны дотоод дугаар (системийн нэршлээр) |


<br>


### 📋 `GAM_SMT` (146 багана, 22 нь тайлбартай)
| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **B_ACNTNAME2** | `Nullable(String)` | Дансны хоёрдогч нэр |
| **B_AC_CR_PREF_PCNT** | `Nullable(Float32)` | Кредит дансны хуваарилалтын хувь |
| **B_AC_DR_PREF_PCNT** | `Nullable(Float32)` | Дебит дансны хуваарилалтын хувь |
| **B_B2K_TYPE** | `Nullable(String)` | B2K төрлийн код |
| **B_BALANCE** | `Nullable(Float32)` | Дансны үлдэгдэл |
| **B_BALANCE_LASTMON_MNT** | `Nullable(Float32)` | Өмнөх сарын дансны үлдэгдэл |
| **B_CATEGORY** | `Nullable(String)` | Дансны ангилал |
| **B_CHNL_CR_PREF_PCNT** | `Nullable(Float32)` | Сувгийн кредит хуваарилалтын хувь |
| **B_CHNL_DR_PREF_PCNT** | `Nullable(Float32)` | Сувгийн дебит хуваарилалтын хувь |
| **B_CRACRINT** | `Nullable(Float32)` | Хуримтлагдсан кредит хүү |
| **B_CRADJINT_CR** | `Nullable(Float32)` | Кредит хүүгийн тохируулга (кредит тал) |
| **B_CRADJINT_DR** | `Nullable(Float32)` | Кредит хүүгийн тохируулга (дебит тал) |
| **B_CRCAPACCOUNT** | `Nullable(String)` | Кредит хүү капиталжуулах данс |
| **B_CRCAPTOTAL** | `Nullable(Float32)` | Кредит хүүгийн нийт капиталжуулсан дүн |
| **B_CRDAILYINT** | `Nullable(Float32)` | Өдрийн кредит хүү |
| **B_CRINT2ACR** | `Nullable(Float32)` | Кредит хүүгийн хуримтлалд шилжсэн дүн |
| **B_CTACRUEL** | `Nullable(Float32)` | Нийт хуримтлагдсан хүү |
| **B_CTCOMACRUEL** | `Nullable(Float32)` | Комиссын хуримтлагдсан хүү |
| **B_CTFINEACRUEL** | `Nullable(Float32)` | Торгуулийн хуримтлагдсан хүү |
| **B_CUST_CR_PREF_PCNT** | `Nullable(Float32)` | Харилцагчийн кредит хуваарилалтын хувь |
| **B_CUST_DR_PREF_PCNT** | `Nullable(Float32)` | Харилцагчийн дебит хуваарилалтын хувь |
| **B_DRACRINT** | `Nullable(Float32)` | Хуримтлагдсан дебит хүү |
| **B_DRADJINT_CR** | `Nullable(Float32)` | Дебит хүүгийн тохируулга (кредит тал) |
| **B_DRADJINT_DR** | `Nullable(Float32)` | Дебит хүүгийн тохируулга (дебит тал) |
| **B_INTRATE_CR** | `Nullable(Float32)` | Кредит хүүгийн хувь |
| **B_INTRATE_DR** | `Nullable(Float32)` | Дебит хүүгийн хувь |
| **B_LIEN_EXPIRY_DATE** | `Nullable(Date)` | Барьцааны хугацаа дуусах огноо |
| **B_LIEN_REASON_CODE** | `Nullable(String)` | Барьцааны шалтгааны код |
| **B_LIEN_REMARKS** | `Nullable(String)` | Барьцааны тайлбар |
| **B_LIEN_START_DATE** | `Nullable(Date)` | Барьцаа эхэлсэн огноо |
| **B_ODENDDATE** | `Nullable(Date)` | Овердрафтын дуусах огноо |
| **B_ODSTARTDATE** | `Nullable(Date)` | Овердрафтын эхлэх огноо |
| **B_RATE** | `Nullable(Float32)` | Гүйлгээний ханш |
| **B_RELACNTNO** | `Nullable(String)` | Холбоотой дансны дугаар |
| **B_SEGMENT** | `Nullable(String)` | Дансны сегмент |
| **B_TERMBASIS** | `Nullable(String)` | Хугацааны тооцооллын үндэс |
| **B_TERMTYPE** | `Nullable(Float32)` | Хугацааны төрөл |
| **B_TOTALBALPERIOD** | `Nullable(Float32)` | Нийт үлдэгдлийн хугацааны дүн |
| **B_TOTALDAYPERIOD** | `Nullable(Float32)` | Нийт хоногийн тоо |
| **B_TXNDATE** | `Date` | Гүйлгээний огноо |
| **B_TXNDAY** | `Nullable(Float32)` | Гүйлгээ хийгдсэн хоногийн тоо |
| **B_TXN_CT** | `Nullable(Float32)` | Кредит гүйлгээний тоо |
| **B_TXN_DT** | `Nullable(Float32)` | Дебит гүйлгээний тоо |
| **EFFECTIVE_PROV_AMT** | `Nullable(Float32)` | Үр дүнтэй нөөцийн дүн |

| **G_ACCT_CLS_DATE** | `Nullable(Date)` | Данс хаагдсан огноо |
| **G_ACCT_CLS_FLG** | `Nullable(String)` | Данс хаагдсан эсэх (`Y` = тийм) |
| **G_ACCT_CRNCY_CODE** | `Nullable(String)` | Дансны валютын код |
| **G_ACCT_LOCN_CODE** | `Nullable(String)` | Дансны байршлын код |
| **G_ACCT_MGR_USER_ID** | `Nullable(String)` | Дансны менежерийн хэрэглэгчийн дугаар |
| **G_ACCT_MOD_FLG** | `Nullable(String)` | Данс өөрчлөгдсөн эсэхийн тэмдэглэгээ |
| **G_ACCT_NAME** | `Nullable(String)` | Дансны нэр |
| **G_ACCT_NUM** | `Nullable(String)` | Дансны дугаар |
| **G_ACCT_OPN_DATE** | `Nullable(Date)` | Данс нээсэн огноо |
| **G_ACCT_OWNERSHIP** | `Nullable(String)` | Дансны эзэмшлийн хэлбэр |
| **G_ACCT_PREFIX** | `Nullable(String)` | Дансны угтвар код |
| **G_ACCT_RPT_CODE** | `Nullable(String)` | Дансны тайлангийн код |
| **G_ACCT_SHORT_NAME** | `Nullable(String)` | Дансны товчилсон нэр |
| **G_ACCT_TURNOVER_DET_FLG** | `Nullable(String)` | Дансны эргэлтийн дэлгэрэнгүй мэдээлэлтэй эсэх |
| **G_ACID** | `String` | Дансны дотоод дугаар |
| **G_ACRD_CR_AMT** | `Nullable(Float32)` | Хуримтлагдсан кредит дүн |
| **G_ANW_NON_CUST_ALWD_FLG** | `Nullable(String)` | Харилцагч бус ашиглахыг зөвшөөрсөн эсэх |
| **G_BACID** | `Nullable(String)` | Балансын дансны дотоод дугаар |
| **G_BAL_ON_FREZ_DATE** | `Nullable(Float32)` | Хөлдөлтийн үеийн үлдэгдэл |
| **G_BAL_ON_PURGE_DATE** | `Nullable(Float32)` | Устгалын үеийн үлдэгдэл |
| **G_BANK_ID** | `Nullable(String)` | Банкны код |
| **G_CHANNEL_ID** | `Nullable(String)` | Сувгийн код |
| **G_CHANNEL_LEVEL_CODE** | `Nullable(String)` | Сувгийн түвшний код |
| **G_CIF_ID** | `Nullable(String)` | Харилцагчийн CIF дугаар |
| **G_CLR_BAL_AMT** | `Nullable(Float32)` | Боломжит үлдэгдэл |
| **G_CONS_BAL_FLG** | `Nullable(String)` | Нэгдсэн үлдэгдэл ашиглах эсэх |
| **G_CRNCY_CODE** | `Nullable(String)` | Валютын код |
| **G_CUM_CR_AMT** | `Nullable(Float32)` | Нийт кредит гүйлгээний дүн |
| **G_CUM_DR_AMT** | `Nullable(Float32)` | Нийт дебит гүйлгээний дүн |
| **G_CUST_ID** | `Nullable(String)` | Харилцагчийн код |
| **G_DEL_FLG** | `Nullable(String)` | Устгасан эсэх (`Y` = тийм) |
| **G_DR_BAL_LIM** | `Nullable(Float32)` | Дебит үлдэгдлийн дээд хязгаар |
| **G_DR_INT_METHOD** | `Nullable(String)` | Дебит хүү тооцох арга |
| **G_EMP_ID** | `Nullable(String)` | Ажилтны дугаар |
| **G_ENTITY_CRE_FLG** | `Nullable(String)` | Нэгж үүсгэсэн эсэх |
| **G_FORACID** | `Nullable(String)` | Дансны гадаад дугаар |
| **G_FREZ_CODE** | `Nullable(String)` | Хөлдөлтийн код |
| **G_FREZ_REASON_CODE** | `Nullable(String)` | Хөлдөлтийн шалтгааны код |
| **G_GL_SUB_HEAD_CODE** | `Nullable(String)` | Ерөнхий дансны дэд код |
| **G_IBAN_NUMBER** | `Nullable(String)` | IBAN дугаар |
| **G_INT_COLL_FLG** | `Nullable(String)` | Хүү цуглуулах эсэх |
| **G_INT_PAID_FLG** | `Nullable(String)` | Хүү төлөгдсөн эсэх |
| **G_LAST_ANY_TRAN_DATE** | `Nullable(Date)` | Сүүлд хийгдсэн гүйлгээний огноо |
| **G_LAST_FREZ_DATE** | `Nullable(Date)` | Сүүлд хөлдсөн огноо |
| **G_LAST_MODIFIED_DATE** | `Nullable(Date)` | Сүүлд өөрчлөгдсөн огноо |
| **G_LAST_PURGE_DATE** | `Nullable(Date)` | Сүүлд устгал хийсэн огноо |
| **G_LAST_TRAN_DATE_CR** | `Nullable(Date)` | Сүүлийн кредит гүйлгээний огноо |
| **G_LAST_TRAN_DATE_DR** | `Nullable(Date)` | Сүүлийн дебит гүйлгээний огноо |
| **G_LAST_TRAN_ID_CR** | `Nullable(String)` | Сүүлийн кредит гүйлгээний дугаар |
| **G_LAST_TRAN_ID_DR** | `Nullable(String)` | Сүүлийн дебит гүйлгээний дугаар |
| **G_LAST_TURNOVER_DATE** | `Nullable(Date)` | Сүүлийн эргэлтийн огноо |
| **G_LAST_UNFREZ_DATE** | `Nullable(Date)` | Сүүлд хөлдөлт цуцлагдсан огноо |
| **G_LCHG_TIME** | `Nullable(DateTime)` | Сүүлд өөрчилсөн огноо, цаг |
| **G_LCHG_USER_ID** | `Nullable(String)` | Сүүлд өөрчилсөн хэрэглэгч |
| **G_LIEN_AMT** | `Nullable(Float32)` | Барьцаалсан дүн |
| **G_LIMIT_B2KID** | `Nullable(String)` | Зээлийн хязгаарын код |
| **G_MASTER_B2K_ID** | `Nullable(String)` | Үндсэн B2K дугаар |
| **G_NOM_AVAILABLE_FLG** | `Nullable(String)` | Нэр дэвшигч бүртгэлтэй эсэх |
| **G_RCRE_TIME** | `Nullable(DateTime)` | Бүртгэсэн огноо, цаг |
| **G_RCRE_USER_ID** | `Nullable(String)` | Бүртгэсэн хэрэглэгч |
| **G_SANCT_LIM** | `Nullable(Float32)` | Батлагдсан зээлийн хязгаар |
| **G_SCHM_CODE** | `Nullable(String)` | Бүтээгдэхүүний код |
| **G_SCHM_SUB_TYPE** | `Nullable(String)` | Бүтээгдэхүүний дэд төрөл |
| **G_SCHM_TYPE** | `Nullable(String)` | Бүтээгдэхүүний төрөл |
| **G_SOL_ID** | `Nullable(String)` | Салбарын код |
| **G_SOURCE_OF_FUND** | `Nullable(String)` | Хөрөнгийн эх үүсвэр |

| **S_ACCT_CLS_REASON_CODE** | `Nullable(String)` | Данс хаасан шалтгааны код |
| **S_ACCT_CRFILE_REF_ID** | `Nullable(String)` | Кредит файлын лавлах дугаар |
| **S_ACCT_INSTNT_CR_FACIL_FLG** | `Nullable(String)` | Шууд кредит олгох боломжтой эсэх |
| **S_ACCT_MIN_BALANCE** | `Nullable(Float32)` | Дансны доод үлдэгдэл |
| **S_ACCT_MIN_BAL_IND** | `Nullable(String)` | Доод үлдэгдлийн тэмдэглэгээ |
| **S_ACCT_STATUS** | `Nullable(String)` | Дансны төлөв |
| **S_ACCT_STATUS_DATE** | `Nullable(Date)` | Төлөв өөрчлөгдсөн огноо |
| **S_ACID** | `Nullable(String)` | Дансны дотоод дугаар (S) |
| **S_BANK_ID** | `Nullable(String)` | Банкны код (S) |
| **S_DR_FREQ_START_DATE** | `Nullable(Date)` | Дебит давтамж эхлэх огноо |
| **S_HEALTH_CODE** | `Nullable(String)` | Эрсдэлийн / төлөвийн код |
| **S_LAST_AOD_AOS_DATE** | `Nullable(Date)` | Сүүлийн AOD/AOS огноо |
| **S_LAST_LF_CALC_DATE** | `Nullable(Date)` | Сүүлийн торгуулийн тооцооны огноо |
| **S_LCHG_TIME** | `Nullable(DateTime)` | Сүүлд өөрчилсөн огноо, цаг |
| **S_LCHG_USER_ID** | `Nullable(String)` | Сүүлд өөрчилсөн хэрэглэгч |
| **S_LF_CHRG_PEND_LINES** | `Nullable(Float32)` | Хүлээгдэж буй торгуулийн мөрийн тоо |
| **S_LM_LINK_STAT** | `Nullable(String)` | LM холболтын төлөв |
| **S_MAX_ALWD_ADVN_LIM** | `Nullable(Float32)` | Зөвшөөрөгдсөн дээд зээлийн хэмжээ |
| **S_NET_PROFIT_RATE** | `Nullable(Float32)` | Цэвэр ашгийн хувь |
| **S_NEXT_DORM_CHRG_CALC_DATE** | `Nullable(Date)` | Дараагийн идэвхгүй хураамж тооцох огноо |
| **S_NEXT_INACT_CHRG_CALC_DATE** | `Nullable(Date)` | Дараагийн ашиглалтгүй хураамж тооцох огноо |
| **S_NS_PERD_CLS_DAYS** | `Nullable(Float32)` | Хаалтын хугацаа (хоногоор) |
| **S_NS_PERD_CLS_MTHS** | `Nullable(Float32)` | Хаалтын хугацаа (сараар) |
| **S_NS_PERD_WD_DAYS** | `Nullable(Float32)` | Татан авалтын хугацаа (хоногоор) |
| **S_NS_PERD_WD_MTHS** | `Nullable(Float32)` | Татан авалтын хугацаа (сараар) |
| **S_PAYOUT_ON_CLOSURE** | `Nullable(String)` | Хаах үед төлбөр хийх эсэх |
| **S_PRODUCT_TYPE** | `Nullable(String)` | Бүтээгдэхүүний төрөл |
| **S_RCRE_TIME** | `Nullable(DateTime)` | Үүсгэсэн огноо, цаг |
| **S_RCRE_USER_ID** | `Nullable(String)` | Үүсгэсэн хэрэглэгч |
| **S_RT_SWEEP_FLG** | `Nullable(String)` | Автомат шилжүүлэг идэвхтэй эсэх |
| **S_SBCA_ACCT_TYPE** | `Nullable(String)` | SBCA дансны төрөл |
| **S_TS_CNT** | `Nullable(Float32)` | Цагийн тэмдэглэлийн тоолуур |
| **G_FREZ_REASON_CODE_2** | `Nullable(String)` | Хоёрдугаар хөлдөөлтийн шалтгааны код |
| **G_FREZ_REASON_CODE_3** | `Nullable(String)` | Гуравдугаар хөлдөөлтийн шалтгааны код |
| **G_FREZ_REASON_CODE_4** | `Nullable(String)` | Дөрөвдүгээр хөлдөөлтийн шалтгааны код |
| **G_FREZ_REASON_CODE_5** | `Nullable(String)` | Тавдугаар хөлдөөлтийн шалтгааны код |
 <br>


### 📋 `GAM_TAM` (222 багана, 22 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **B_AC_CR_PREF_PCNT** | `Nullable(Float32)` | Кредит дансны хуваарилалтын хувь |
| **B_AC_DR_PREF_PCNT** | `Nullable(Float32)` | Дебит дансны хуваарилалтын хувь |
| **B_B2K_TYPE** | `Nullable(String)` | B2K төрлийн код |
| **B_BALANCE** | `Nullable(Float32)` | Дансны үлдэгдэл |
| **B_BALANCE_LASTMON_MNT** | `Nullable(Float32)` | Өмнөх сарын дансны үлдэгдэл |
| **B_CATEGORY** | `Nullable(String)` | Дансны ангилал |
| **B_CHNL_CR_PREF_PCNT** | `Nullable(Float32)` | Сувгийн кредит хуваарилалтын хувь |
| **B_CHNL_DR_PREF_PCNT** | `Nullable(Float32)` | Сувгийн дебит хуваарилалтын хувь |
| **B_CRACRINT** | `Nullable(Float32)` | Хуримтлагдсан кредит хүү |
| **B_CRADJINT_CR** | `Nullable(Float32)` | Кредит хүүгийн тохируулга (кредит тал) |
| **B_CRADJINT_DR** | `Nullable(Float32)` | Кредит хүүгийн тохируулга (дебит тал) |
| **B_CRCAPACCOUNT** | `Nullable(String)` | Кредит хүү капиталжуулах данс |
| **B_CRCAPTOTAL** | `Nullable(Float32)` | Кредит хүүгийн нийт капиталжуулсан дүн |
| **B_CRDAILYINT** | `Nullable(Float32)` | Өдрийн кредит хүү |
| **B_CUST_CR_PREF_PCNT** | `Nullable(Float32)` | Харилцагчийн кредит хуваарилалтын хувь |
| **B_CUST_DR_PREF_PCNT** | `Nullable(Float32)` | Харилцагчийн дебит хуваарилалтын хувь |
| **B_DRACRINT** | `Nullable(Float32)` | Хуримтлагдсан дебит хүү |
| **B_DRADJINT_CR** | `Nullable(Float32)` | Дебит хүүгийн тохируулга (кредит тал) |
| **B_DRADJINT_DR** | `Nullable(Float32)` | Дебит хүүгийн тохируулга (дебит тал) |
| **B_INTRATE_CR** | `Nullable(Float32)` | Кредит хүүгийн хувь |
| **B_INTRATE_DR** | `Nullable(Float32)` | Дебит хүүгийн хувь |
| **B_LIEN_REASON_CODE** | `Nullable(String)` | Барьцааны шалтгааны код |
| **B_LIEN_REMARKS** | `Nullable(String)` | Барьцааны тайлбар |
| **B_LIEN_START_DATE** | `Nullable(Date)` | Барьцаа эхэлсэн огноо |
| **B_RATE** | `Nullable(Float32)` | Гүйлгээний ханш |
| **B_RELACNTNO** | `Nullable(String)` | Холбоотой дансны дугаар |
| **B_RENEWAL_TYPE** | `Nullable(String)` | Хадгаламж шинэчлэлтийн төрөл |
| **B_SEGMENT** | `Nullable(String)` | Дансны сегмент |
| **B_TERMBASIS** | `Nullable(String)` | Хугацааны тооцооллын үндэс |
| **B_TERMTYPE** | `Nullable(Float32)` | Хугацааны төрөл |
| **B_TRAN_AMT_CT** | `Nullable(Float32)` | Кредит гүйлгээний нийт дүн |
| **B_TRAN_AMT_DT** | `Nullable(Float32)` | Дебит гүйлгээний нийт дүн |
| **B_TXNDATE** | `Date` | Гүйлгээний огноо |
| **B_TXNDAY** | `Nullable(Float32)` | Гүйлгээ хийгдсэн хоногийн тоо |

| **G_ACCT_CLS_DATE** | `Nullable(Date)` | Данс хаагдсан огноо |
| **G_ACCT_CLS_FLG** | `Nullable(String)` | Данс хаагдсан эсэх (`Y` = тийм) |
| **G_ACCT_CRNCY_CODE** | `Nullable(String)` | Дансны валютын код |
| **G_ACCT_LOCN_CODE** | `Nullable(String)` | Дансны байршлын код |
| **G_ACCT_MGR_USER_ID** | `Nullable(String)` | Дансны менежерийн хэрэглэгчийн ID |
| **G_ACCT_MOD_FLG** | `Nullable(String)` | Данс өөрчлөгдсөн эсэхийн тэмдэглэгээ |
| **G_ACCT_NAME** | `Nullable(String)` | Дансны нэр |
| **G_ACCT_NUM** | `Nullable(String)` | Дансны дугаар |
| **G_ACCT_OPN_DATE** | `Nullable(Date)` | Данс нээсэн огноо |
| **G_ACCT_OWNERSHIP** | `Nullable(String)` | Данс эзэмшлийн хэлбэр |
| **G_ACCT_PREFIX** | `Nullable(String)` | Дансны угтвар код |
| **G_ACCT_RPT_CODE** | `Nullable(String)` | Дансны тайлангийн код |
| **G_ACCT_SHORT_NAME** | `Nullable(String)` | Дансны товчилсон нэр |
| **G_ACCT_TURNOVER_DET_FLG** | `Nullable(String)` | Дансны эргэлтийн дэлгэрэнгүй мэдээлэлтэй эсэх |
| **G_ACID** | `String` | Дансны дотоод дугаар |
| **G_CLR_BAL_AMT** | `Nullable(Float32)` | Боломжит үлдэгдэл |
| **G_CUM_CR_AMT** | `Nullable(Float32)` | Нийт кредит гүйлгээний дүн |
| **G_CUM_DR_AMT** | `Nullable(Float32)` | Нийт дебит гүйлгээний дүн |
| **G_CUST_ID** | `Nullable(String)` | Харилцагчийн код |
| **G_SOL_ID** | `Nullable(String)` | Салбарын код |
| **G_SOURCE_OF_FUND** | `Nullable(String)` | Хөрөнгийн эх үүсвэр |

| **T_DEPOSIT_AMOUNT** | `Nullable(Float32)` | Хадгаламжийн дүн |
| **T_DEPOSIT_PERIOD_DAYS** | `Nullable(Float32)` | Хадгаламжийн хугацаа (хоногоор) |
| **T_DEPOSIT_PERIOD_MTHS** | `Nullable(Float32)` | Хадгаламжийн хугацаа (сараар) |
| **T_DEPOSIT_TYPE** | `Nullable(String)` | Хадгаламжийн төрөл |
| **T_MATURITY_DATE** | `Nullable(Date)` | Хугацаа дуусах огноо |
| **T_MATURITY_AMOUNT** | `Nullable(Float32)` | Хугацаа дуусахад авах дүн |
| **T_AUTO_RENEWAL_FLG** | `Nullable(String)` | Автоматаар сунгах эсэх |
| **T_RENEWAL_RATE** | `Nullable(Float32)` | Шинэчлэлтийн хүүгийн хувь |
| **T_CUM_INT_PAID** | `Nullable(Float32)` | Нийт төлсөн хүү |
| **T_CUM_PRINCIPAL** | `Nullable(Float32)` | Нийт үндсэн хадгаламж |
| **T_PENALTY_AMOUNT** | `Nullable(Float32)` | Торгуулийн дүн |
| **T_LAST_REPAYMENT_DATE** | `Nullable(Date)` | Сүүлд төлбөр хийсэн огноо |
| **T_NEXT_BONUS_RUN_DATE** | `Nullable(Date)` | Дараагийн урамшууллын тооцооны огноо |
| **T_BONUS_CYCLE** | `Nullable(Float32)` | Урамшууллын мөчлөг |
| **T_SOL_ID** | `Nullable(String)` | Салбарын код |
| **T_RCRE_TIME** | `DateTime` | Үүсгэсэн огноо, цаг |
| **T_LCHG_TIME** | `DateTime` | Сүүлд өөрчилсөн огноо, цаг |
| **G_ENTITY_CRE_FLG** | `Nullable(String)` | Аж ахуйн нэгж үүссэн эсэх тэмдэглэгч |
| **G_DEL_FLG** | `Nullable(String)` | Устгагдсан эсэх тэмдэглэгч |
| **G_BACID** | `Nullable(String)` | Банкны дансны дотоод дугаар (BACID) |
| **G_FORACID** | `Nullable(String)` | Харилцагчийн дансны гадаад дугаар (FORACID) |
| **G_EMP_ID** | `Nullable(String)` | Дансыг үүсгэсэн ажилтны дугаар |
| **G_GL_SUB_HEAD_CODE** | `Nullable(String)` | Ерөнхий дэвтрийн дэд ангиллын код |
| **G_SCHM_CODE** | `Nullable(String)` | Бүтээгдэхүүний схемийн код |
| **G_DR_BAL_LIM** | `Nullable(Float32)` | Дебит үлдэгдлийн зөвшөөрөгдөх хязгаар |
| **G_FREZ_CODE** | `Nullable(String)` | Хөлдөөлтийн код |
| **G_FREZ_REASON_CODE** | `Nullable(String)` | Хөлдөөлтийн шалтгааны код |
| **G_SANCT_LIM** | `Nullable(Float32)` | Банкаас зөвшөөрсөн зээлийн хязгаар |
| **G_ACRD_CR_AMT** | `Nullable(Float32)` | Хуримтлагдсан кредитийн дүн |
| **G_NOM_AVAILABLE_FLG** | `Nullable(String)` | Нэрлэсэн данс боломжтой эсэх тэмдэглэгч |
| **G_LAST_PURGE_DATE** | `Nullable(Date)` | Архивлалт хийсэн сүүлийн огноо |
| **G_BAL_ON_PURGE_DATE** | `Nullable(Float32)` | Архивлалтын өдрийн дансны үлдэгдэл |
| **G_INT_PAID_FLG** | `Nullable(String)` | Хүү төлсөн эсэх тэмдэглэгч |
| **G_INT_COLL_FLG** | `Nullable(String)` | Хүү цуглуулсан эсэх тэмдэглэгч |
| **G_LAST_ANY_TRAN_DATE** | `Nullable(Date)` | Сүүлийн аливаа гүйлгээний огноо |
| **G_LCHG_USER_ID** | `Nullable(String)` | Мэдээллийг сүүлд өөрчилсөн хэрэглэгчийн дугаар |
| **G_LCHG_TIME** | `DateTime` | Мэдээллийг сүүлд өөрчилсөн цаг |
| **G_RCRE_USER_ID** | `Nullable(String)` | Бүртгэл үүсгэсэн хэрэглэгчийн дугаар |
| **G_RCRE_TIME** | `DateTime` | Бүртгэл үүссэн цаг |
| **G_LIMIT_B2KID** | `Nullable(String)` | Хязгаарын B2K систем дэх дугаар |
| **G_LAST_TURNOVER_DATE** | `Nullable(Date)` | Сүүлийн эргэлтийн огноо |
| **G_CRNCY_CODE** | `Nullable(String)` | Дансны валютын код |
| **G_ANW_NON_CUST_ALWD_FLG** | `Nullable(String)` | Харилцагч бус этгээдэд зөвшөөрөх эсэх тэмдэглэгч |
| **G_LIEN_AMT** | `Nullable(Float32)` | Лиен (барьцаа татсан) дүн |
| **G_SCHM_TYPE** | `Nullable(String)` | Схемийн төрөл |
| **G_LAST_FREZ_DATE** | `Nullable(Date)` | Дансыг сүүлд хөлдөөсөн огноо |
| **G_LAST_UNFREZ_DATE** | `Nullable(Date)` | Дансны хөлдөөлтийг сүүлд тайлсан огноо |
| **G_BAL_ON_FREZ_DATE** | `Nullable(Float32)` | Хөлдөөлтийн өдрийн дансны үлдэгдэл |
| **G_LAST_MODIFIED_DATE** | `Nullable(Date)` | Мэдээллийг сүүлд өөрчилсөн огноо |
| **G_CIF_ID** | `Nullable(String)` | Харилцагчийн CIF дугаар |
| **G_IBAN_NUMBER** | `Nullable(String)` | Олон улсын банкны IBAN дансны дугаар |
| **G_CHANNEL_LEVEL_CODE** | `Nullable(String)` | Сувгийн түвшний код |
| **G_CHANNEL_ID** | `Nullable(String)` | Сувгийн дугаар |
| **G_MASTER_B2K_ID** | `Nullable(String)` | Эх дансны B2K систем дэх дугаар |
| **G_BANK_ID** | `Nullable(String)` | Банкны дугаар |
| **G_FREZ_REASON_CODE_2** | `Nullable(String)` | Хоёрдугаар хөлдөөлтийн шалтгааны код |
| **G_FREZ_REASON_CODE_3** | `Nullable(String)` | Гуравдугаар хөлдөөлтийн шалтгааны код |
| **G_FREZ_REASON_CODE_4** | `Nullable(String)` | Дөрөвдүгээр хөлдөөлтийн шалтгааны код |
| **G_FREZ_REASON_CODE_5** | `Nullable(String)` | Тавдугаар хөлдөөлтийн шалтгааны код |
| **G_LAST_TRAN_DATE_CR** | `Nullable(Date)` | Сүүлийн кредит гүйлгээний огноо |
| **G_LAST_TRAN_DATE_DR** | `Nullable(Date)` | Сүүлийн дебит гүйлгээний огноо |
| **G_LAST_TRAN_ID_CR** | `Nullable(String)` | Сүүлийн кредит гүйлгээний дугаар |
| **G_LAST_TRAN_ID_DR** | `Nullable(String)` | Сүүлийн дебит гүйлгээний дугаар |
| **G_DR_INT_METHOD** | `Nullable(String)` | Дебит хүүг тооцох арга |
| **G_CONS_BAL_FLG** | `Nullable(String)` | Нэгтгэсэн үлдэгдлийн тэмдэглэгч |
| **G_SCHM_SUB_TYPE** | `Nullable(String)` | Схемийн дэд төрөл |
| **T_ACID** | `Nullable(String)` | Хугацаат хадгаламжийн дансны дугаар (ACID) |
| **T_OPEN_EFFECTIVE_DATE** | `Nullable(Date)` | Данс нээлттэй болсон хүчин төгөлдөр огноо |
| **T_ADJUSTED_COMM_AMT** | `Nullable(Float32)` | Тоохируулсан шимтгэлийн дүн |
| **T_DEPOSIT_STATUS** | `Nullable(String)` | Хадгаламжийн өнөөгийн байдал |
| **T_ACCT_SEGMENT** | `Nullable(String)` | Дансны сегмент ангилал |
| **T_SAFE_CUSTODY_FLG** | `Nullable(String)` | Аюулгүй хадгалалтанд байгаа эсэх тэмдэглэгч |
| **T_NOMINEE_PRINT_FLG** | `Nullable(String)` | Нэрлэгдсэн хүний мэдээлэл хэвлэх тэмдэглэгч |
| **T_PRINTING_FLG** | `Nullable(String)` | Хэвлэх тэмдэглэгч |
| **T_SPL_CATG_IND** | `Nullable(String)` | Тусгай ангиллын үзүүлэлт |
| **T_XFER_IN_IND** | `Nullable(String)` | Өөр байгуулагаас шилжүүлэн ирснийг заах үзүүлэлт |
| **T_LAST_INT_PROVISION_DATE** | `Nullable(Date)` | Хүүгийн нөөцлөлт хийсэн сүүлийн огноо |
| **T_CUM_INSTL_PAID** | `Nullable(Float32)` | Хуримтлагдсан тогтмол тааварын нийт дүн |
| **T_CUM_REPAYMENT_PAID** | `Nullable(Float32)` | Хуримтлагдсан эргэн төлөлтийн нийт дүн |
| **T_CUM_INT_CREDITED** | `Nullable(Float32)` | Кредитэд орсон хуримтлагдсан хүүгийн нийт дүн |
| **T_INT_ACCRUAL_FLG** | `Nullable(String)` | Хүү хуримтлуулах тэмдэглэгч |
| **T_RELATED_ACID** | `Nullable(String)` | Холбоотой дансны дугаар |
| **T_PENAL_PCNT** | `Nullable(Float32)` | Торгуулийн хувь хэмжээ |
| **T_REPAYMENT_ACID** | `Nullable(String)` | Эргэн төлөлтийн дансны дугаар |
| **T_LOAN_ACID** | `Nullable(String)` | Холбоотой зээлийн дансны дугаар |
| **T_PENALTY_RECOVERED** | `Nullable(Float32)` | Нөхөн авсан торгуулийн дүн |
| **T_PENALTY_WAIVED** | `Nullable(Float32)` | Чөлөөлсөн (уучилсан) торгуулийн дүн |
| **T_AGENT_EMP_IND** | `Nullable(String)` | Агент ажилтан эсэх үзүүлэлт |
| **T_AGENT_CODE** | `Nullable(String)` | Агентийн код |
| **T_MATURITY_NOTICE_DATE** | `Nullable(Date)` | Хугацаа дуусах тухай мэдэгдлийн огноо |
| **T_LCHG_USER_ID** | `Nullable(String)` | Мэдээллийг сүүлд өөрчилсөн хэрэглэгчийн дугаар |
| **T_RCRE_USER_ID** | `Nullable(String)` | Бүртгэл үүсгэсэн хэрэглэгчийн дугаар |
| **T_TDS_AMT** | `Nullable(Float32)` | Эх үүсвэрт суутгасан татварын дүн (TDS) |
| **T_INT_CR_RATE_CODE** | `Nullable(String)` | Хүүгийн кредит хувийн код |
| **T_NOSTRO_VALUE_DATE** | `Nullable(Date)` | Ностро дансны хүчин төгөлдөр огноо |
| **T_OVERDUE_INT_AMT** | `Nullable(Float32)` | Хугацаа хэтэрсэн хүүгийн дүн |
| **T_CLS_VALUE_DATE** | `Nullable(Date)` | Хаалтын хүчин төгөлдөр огноо |
| **T_PERD_MTHS_FOR_AUTO_RENW** | `Nullable(Float32)` | Автомат сунгалтын хугацааны сарын тоо |
| **T_PERD_DAYS_FOR_AUTO_RENW** | `Nullable(Float32)` | Автомат сунгалтын хугацааны өдрийн тоо |
| **T_MAX_AUTO_RENEWAL_ALLOWED** | `Nullable(Float32)` | Зөвшөөрөгдсөн дээд тал автомат сунгалтын тоо |
| **T_AUTO_RENEWED_COUNTER** | `Nullable(Float32)` | Автоматаар сунгасан удаагийн тоолуур |
| **T_CLOSE_ON_MATURITY_FLG** | `Nullable(String)` | Хугацаа болоход дансыг хаах тэмдэглэгч |
| **T_AUTO_RENWL_SCHM_CODE** | `Nullable(String)` | Автомат сунгалтын схемийн код |
| **T_AUTO_RENWL_INT_TBL_CODE** | `Nullable(String)` | Автомат сунгалтын хүүгийн хүснэгтийн код |
| **T_AUTO_RENWL_GL_SUBHEAD_CODE** | `Nullable(String)` | Автомат сунгалтын ерөнхий дэвтрийн дэд ангиллын код |
| **T_RENEWAL_CRNCY** | `Nullable(String)` | Сунгалтын валют |
| **T_RENEWAL_RATE_CODE** | `Nullable(String)` | Сунгалтад ашиглах хүүгийн хувийн код |
| **T_TS_CNT** | `Nullable(Float32)` | Гүйлгээний тоолуур |
| **T_ORIGINAL_DEP_AMOUNT** | `Nullable(Float32)` | Анхны хадгаламжийн дүн |
| **T_NOTICE_PERIOD_MNTHS** | `Nullable(Float32)` | Мэдэгдлийн хугацааны сарын тоо |
| **T_NOTICE_PERIOD_DAYS** | `Nullable(Float32)` | Мэдэгдлийн хугацааны өдрийн тоо |
| **T_NOTICE_DATE** | `Nullable(Date)` | Мэдэгдлийн огноо |
| **T_ACCT_CLOSE_INT_RATE** | `Nullable(Float32)` | Данс хаах үеийн хүүгийн хувь |
| **T_TRAN_ID** | `Nullable(String)` | Гүйлгээний дугаар |
| **T_TXOD_REGL_OVERDRAFT** | `Nullable(String)` | Зохицуулалттай овердрафтын тэмдэглэгч |
| **T_ORIGINAL_MATURITY_AMOUNT** | `Nullable(Float32)` | Анхны гэрээний дагуу хугацаа дуусах дүн |
| **T_REN_SRL_NUM** | `Nullable(String)` | Сунгалтын дарааллын дугаар |
| **T_LINK_OPER_ACCOUNT** | `Nullable(String)` | Холбоотой ажиллагааны данс |
| **T_OUTFLOW_MULTIPLE_AMT** | `Nullable(Float32)` | Олон удаагийн гарах урсгалын дүн |
| **T_AVAIL_DEPOSIT_AMT** | `Nullable(Float32)` | Зарцуулах боломжтой хадгаламжийн дүн |
| **T_CUST_INST_TYPE** | `Nullable(String)` | Харилцагчийн байгуулагын төрөл |
| **T_TDS_TOTAL_FROM_SELF_ACCT** | `Nullable(Float32)` | Өөрийн дансаас суутгасан нийт татварын дүн |
| **T_INT_FLOW_FREQ_MTHS** | `Nullable(Float32)` | Хүүгийн урсгалын давтамж (сар тоогоор) |
| **T_INT_FLOW_FREQ_DAYS** | `Nullable(Float32)` | Хүүгийн урсгалын давтамж (өдөр тоогоор) |
| **T_TAM_CRNCY_CODE** | `Nullable(String)` | Хугацаат хадгаламжийн валютын код |
| **T_MASTER_B2K_ID** | `Nullable(String)` | Эх дансны B2K систем дэх дугаар |
| **T_ACCT_STATUS** | `Nullable(String)` | Дансны одоогийн статус |
| **T_ACCT_STATUS_DATE** | `Nullable(Date)` | Дансны статус тогтоосон огноо |
| **T_FIXED_INSTALLMENT_AMT** | `Nullable(Float32)` | Тогтмол тааварын дүн |
| **T_NRML_INSTALLMENT_PCNT** | `Nullable(Float32)` | Ердийн тааварын хувь |
| **T_INSTALLMENT_BASIS** | `Nullable(String)` | Тааварыг тооцоолох үндэслэл |
| **T_MAX_MISS_CONTRIB_ALLOW** | `Nullable(Float32)` | Зөвшөөрөгдсөн дээд тал алдагдсан тааварын тоо |
| **T_AUTO_CLOSURE_OF_IRR_ACCT** | `Nullable(String)` | Тэнцвэргүй дансыг автоматаар хаах тэмдэглэгч |
| **T_TOTAL_NO_OF_MISS_CONTRIB** | `Nullable(Float32)` | Нийт алдагдсан тааварын тоо |
| **T_ACCT_IRREGULAR_STATUS** | `Nullable(String)` | Дансны тэнцвэргүй байдлын статус |
| **T_ACCT_IRREGULAR_STA_DATE** | `Nullable(Date)` | Дансны тэнцвэргүй байдал тогтоосон огноо |
| **T_CUM_NRML_INSTL_PAID** | `Nullable(Float32)` | Хуримтлагдсан ердийн тааварын нийт дүн |
| **T_CUM_INITIAL_DEP_PAID** | `Nullable(Float32)` | Хуримтлагдсан анхны хадгаламжийн нийт дүн |
| **T_CUM_TOP_UP_PAID** | `Nullable(Float32)` | Хуримтлагдсан нэмэлт хадгаламжийн нийт дүн |
| **T_AUTO_CLSR_OF_ZERO_BAL_MNTHS** | `Nullable(Float32)` | Тэг үлдэгдэлтэй дансыг автомат хаах хугацаа (сар) |
| **T_AUTO_CLSR_OF_ZERO_BAL_DAYS** | `Nullable(Float32)` | Тэг үлдэгдэлтэй дансыг автомат хаах хугацаа (өдөр) |
| **T_BANK_ID** | `Nullable(String)` | Банкны дугаар |
| **T_PENALTY_CHARGE_EVENT_ID** | `Nullable(String)` | Торгуулийн гүйлгээний үйл явдлын дугаар |
| **T_NUM_OF_GRACE_DAYS_UTIL** | `Nullable(Float32)` | Ашигласан нэмэлт (grace) хугацааны өдрийн тоо |
| **T_ABSO_PENAL_INT_AMT** | `Nullable(Float32)` | Үнэмлэхүй торгуулийн хүүгийн дүн |
| **T_LAST_BONUS_RUN_DATE** | `Nullable(Date)` | Урамшааллын тооцоо хийсэн сүүлийн огноо |
| **T_LAST_CALC_BONUS_AMOUNT** | `Nullable(Float32)` | Сүүлийн тооцоолсон урамшааллын дүн |
| **T_BONUS_UPTO_DATE** | `Nullable(Float32)` | Урамшуулал тооцсон хамгийн сүүлийн огноо |
| **T_NRML_INT_PAID_TIL_LST_BONUS** | `Nullable(Float32)` | Сүүлийн урамшуулал хүртэл төлсөн ердийн хүүгийн дүн |
| **T_LAST_CALC_BONUS_PCNT** | `Nullable(Float32)` | Сүүлийн тооцоолсон урамшааллын хувь |
| **T_ACCT_CLS_REASON_CODE** | `Nullable(String)` | Данс хаасан шалтгааны код |
| **T_LAST_LOCAL_CAL_UPDATE** | `Nullable(Date)` | Сүүлийн орон нутгийн хуанлийн шинэчлэлийн огноо |
| **T_LOC_DEPOSIT_PERIOD_MTHS** | `Nullable(Float32)` | Орон нутгийн хадгаламжийн хугацаа (сар) |
| **T_LOC_DEPOSIT_PERIOD_DAYS** | `Nullable(Float32)` | Орон нутгийн хадгаламжийн хугацаа (өдөр) |
| **T_ACCT_CLOSE_FWC_NUM** | `Nullable(String)` | Данс хаасан FWC гүйлгээний дугаар |
| **T_ACCT_CLOSE_FWC_SOL_ID** | `Nullable(String)` | Данс хаасан FWC нэгжийн дугаар |
| **T_INT_RATE_BASED_ON** | `Nullable(String)` | Хүүгийн хувийг тооцоолох үндэслэл |
| **T_CUM_PART_CLOSE_AMT** | `Nullable(Float32)` | Хуримтлагдсан хэсэгчилсэн хаалтын нийт дүн |
| **T_PAY_MATURITY_PRFT** | `Nullable(String)` | Хугацаа болоход ашиг олгох тэмдэглэгч |
| **T_PAY_PRECLS_PRFT** | `Nullable(String)` | Хугацааны өмнө хаахад ашиг олгох тэмдэглэгч |
| **T_MURA_DEPOSIT_AMT** | `Nullable(Float32)` | Мурабаха бүтэцтэй хадгаламжийн дүн |
| **T_BROKEN_PERIOD_PROF_IND** | `Nullable(String)` | Тасалдсан хугацааны ашгийн үзүүлэлт |
| **T_CUST_PURCHASE_ID** | `Nullable(String)` | Харилцагчийн худалдан авалтын дугаар |
| **T_LOCK_PERIOD_MTHS** | `Nullable(Float32)` | Хааглах хугацаа (сар) |
| **T_LOCK_PERIOD_DAYS** | `Nullable(Float32)` | Хааглах хугацаа (өдөр) |
| **T_ANNIV_FLG_FOR_COMPL_CYC** | `Nullable(String)` | Бүрэн циклийн ойн тэмдэглэгч |
| **T_OVDU_FREQ_TYPE_FOR_COMP_CYC** | `Nullable(String)` | Бүрэн циклийн хугацаа хэтрэлтийн давтамжийн төрөл |


### 📋 `GSP` (65 багана, 8 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **ACCT_CLS_FORM_NAME** | `Nullable(String)` | Данс хаахад ашиглагддаг маягтын нэр |
| **ACCT_MAINT_FORM_NAME** | `Nullable(String)` | Данс засварлах (maintenance) маягтын нэр |
| **ACCT_OPN_FORM_NAME** | `Nullable(String)` | Данс нээх маягтын нэр |
| **ACCT_PREFIX** | `Nullable(String)` | Дансны дугаарын угтвар |
| **ACCT_TURNOVER_DET_FLG** | `Nullable(String)` | Дансны эргэлтийн дэлгэрэнгүй мэдээлэл хадгалах эсэх (`Y`=тийм) |
| **ADVANCE_INT_BACID** | `Nullable(String)` | Урьдчилгаа хүү тооцох баланс дансны дугаар |
| **BEL_MIN_BAL_EXCP_CODE** | `Nullable(String)` | Доод үлдэгдлийн шаардлагаас чөлөөлөх код |
| **B_SCHM_CLASS** | `Nullable(String)` | Бүтээгдэхүүний (scheme) ангилал |
| **B_SCHM_ORDER** | `Nullable(Float32)` | Бүтээгдэхүүний дарааллын дугаар |
| **CHQ_ALWD_FLG** | `Nullable(String)` | Чек ашиглахыг зөвшөөрсөн эсэх (`Y`=тийм) |
| **CHRGE_OFF_BACID** | `Nullable(String)` | Алдагдалд шилжүүлэх (charge-off) баланс дансны дугаар |
| **DAILY_COMP_INT_FLG** | `Nullable(String)` | Өдөр тутам нийлмэл хүү тооцох эсэх |
| **DEALER_CONTR_BACID** | `Nullable(String)` | Дилерийн гэрээтэй холбоотой баланс дансны дугаар |
| **DEL_FLG** | `Nullable(String)` | Устгасан эсэх (`Y`=устгасан) |
| **DISC_RATE_FLG** | `Nullable(String)` | Хөнгөлөлттэй хүү хэрэглэх эсэх |
| **EEFC_FLG** | `Nullable(String)` | EEFC (гадаад валютын тусгай данс) эсэх тэмдэглэгээ |
| **END_DATE** | `Nullable(Date)` | Дуусах огноо |
| **INTCALC_TRAN_SCRIPT** | `Nullable(String)` | Хүү тооцоолох логик / скрипт |
| **INTER_SOL_CLOSURE_ALWD_FLG** | `Nullable(String)` | Өөр салбарт данс хаахыг зөвшөөрсөн эсэх |
| **INT_COLL_BACID** | `Nullable(String)` | Хүү цуглуулах баланс дансны дугаар |
| **INT_COLL_FLG** | `Nullable(String)` | Хүү цуглуулах эсэх (`Y`=тийм) |
| **INT_FREQ_START_DD_CR** | `Nullable(Float32)` | Кредит хүү тооцож эхлэх өдөр |
| **INT_FREQ_TYPE_CR** | `Nullable(String)` | Кредит хүүгийн давтамжийн төрөл |
| **INT_PAID_BACID** | `Nullable(String)` | Хүү төлөх баланс дансны дугаар |
| **INT_PAID_FLG** | `Nullable(String)` | Хүү төлөгдөх эсэх (`Y`=тийм) |
| **INT_PANDL_BACID_CR** | `Nullable(String)` | Кредит хүүгийн орлого/зардлын баланс данс |
| **INT_PANDL_BACID_DR** | `Nullable(String)` | Дебит хүүгийн орлого/зардлын баланс данс |
| **INT_WAIVER_BACID** | `Nullable(String)` | Чөлөөлөгдсөн хүүгийн баланс данс |
| **LCHG_TIME** | `Date` | Сүүлд өөрчилсөн огноо, цаг |
| **LCHG_USER_ID** | `Nullable(String)` | Сүүлд өөрчилсөн хэрэглэгчийн ID |
| **LIM_LEVEL_INT_FLG** | `Nullable(String)` | Хязгаарын түвшинд хүү тооцох эсэх |
| **MERGE_INT_PTRAN_FLG** | `Nullable(String)` | Хүүгийн гүйлгээг нэгтгэх эсэх |
| **NEXT_ACCT_NUM_PREFIX** | `Nullable(String)` | Дараагийн дансны дугаарын угтвар |
| **NRE_SCHM_FLG** | `Nullable(String)` | NRE (гадаад орлогын) схем эсэх |
| **OFTI_SCHM_RTN_NAME** | `Nullable(String)` | OFTI системд буцаах нэр |
| **PD_DR_TRAN_EXCP_CODE** | `Nullable(String)` | Хугацаа хэтэрсэн дебит гүйлгээний үл хамаарах код |
| **PD_GL_SUB_HEAD_CODE** | `Nullable(String)` | Хугацаа хэтэрсэн гүйлгээний GL дэд код |
| **PD_INT_CALC_EXCP_CODE** | `Nullable(String)` | Хугацаа хэтэрсэн хүү тооцооллоос чөлөөлөх код |
| **PEG_INT_FOR_AC_FLG** | `Nullable(String)` | Дансны хүүг тусгайлан тогтоох эсэх |
| **PENAL_PANDL_BACID** | `Nullable(String)` | Торгуулийн орлого/зардлын баланс данс |
| **PREF_LANG_CODE** | `Nullable(String)` | Илүүд үзэх хэлний код |
| **PREF_LANG_SCHM_DESC** | `Nullable(String)` | Сонгосон хэл дээрх бүтээгдэхүүний тайлбар |
| **PREF_LANG_SCHM_SHORT_NAME** | `Nullable(String)` | Сонгосон хэл дээрх бүтээгдэхүүний товч нэр |
| **PRINCIPAL_LOSSLINE_BACID** | `Nullable(String)` | Үндсэн дүнгийн алдагдлын баланс данс |
| **PRODUCT_GROUP** | `Nullable(String)` | Бүтээгдэхүүний бүлэг |
| **PRODUCT_TYPE** | `Nullable(String)` | Бүтээгдэхүүний төрөл |
| **QIS_INT_FLG** | `Nullable(String)` | QIS төрлийн хүү ашиглах эсэх |
| **RCRE_TIME** | `Nullable(Date)` | Үүсгэсэн огноо, цаг |
| **RCRE_USER_ID** | `Nullable(String)` | Үүсгэсэн хэрэглэгчийн ID |
| **RECOVER_LOSSLINE_BACID** | `Nullable(String)` | Алдагдлыг нөхөн сэргээх баланс данс |
| **SCHM_CODE** | `String` | Бүтээгдэхүүний код (Scheme Code) |
| **SCHM_DESC** | `Nullable(String)` | Бүтээгдэхүүний нэр / тайлбар |
| **SCHM_SHORT_NAME** | `Nullable(String)` | Бүтээгдэхүүний товч нэр |
| **SCHM_TYPE** | `Nullable(String)` | Бүтээгдэхүүний төрөл (ж: SB=Хадгаламж, CA=Харилцах) |
| **SERV_CHRG_BACID** | `Nullable(String)` | Үйлчилгээний шимтгэлийн баланс данс |
| **SET_ID** | `Nullable(String)` | Тохиргооны багцын ID |
| **STAFF_SCHM_FLG** | `Nullable(String)` | Ажилтны тусгай бүтээгдэхүүн эсэх |
| **START_DATE** | `Nullable(Date)` | Эхлэх огноо |
| **STOCK_INT_FLG** | `Nullable(String)` | Хувьцаатай холбоотой хүүгийн тэмдэглэгээ |
| **SYST_GEN_ACCT_NUM_FLG** | `Nullable(String)` | Дансны дугаарыг систем автоматаар үүсгэдэг эсэх |
| **TOT_MOD_TIMES** | `Nullable(Float32)` | Нийт өөрчлөлт хийсэн тоо |
| **TRAN_REF_NUM_FLG** | `Nullable(String)` | Гүйлгээний лавлагааны дугаар ашиглах эсэх |
| **TRAN_RPT_CODE_FLG** | `Nullable(String)` | Тайлангийн код ашиглах эсэх |
| **TS_CNT** | `Nullable(Float32)` | Цагийн тэмдэглэлийн тоолуур |
| **UNPAID_INT_BACID** | `Nullable(String)` | Төлөгдөөгүй хүүгийн баланс данс |

 <br>


### 📋 `HTD_ATD` (113 багана, 44 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **A_ACCT_TRANSFER_FLG** | `Nullable(String)` | Данс хооронд шилжүүлэг хийгдсэн эсэх (`Y`=тийм) |
| **A_BANK_ID** | `Nullable(String)` | Банкны системийн код (A хэсэг) |
| **A_CONT_PART_TRAN_SRL_NUM** | `Nullable(String)` | Холбоотой хэсэгчилсэн гүйлгээний дарааллын дугаар |
| **A_CONT_TRAN_DATE** | `Nullable(Date)` | Холбоотой (тасралтгүй) гүйлгээний огноо |
| **A_CONT_TRAN_ID** | `Nullable(String)` | Холбоотой гүйлгээний дугаар |
| **A_PART_TRAN_SRL_NUM** | `Nullable(String)` | Хэсэгчилсэн гүйлгээний дарааллын дугаар |
| **A_REVERSAL_COMMENTS** | `Nullable(String)` | Буцаалт (reversal)-ын тайлбар |
| **A_REVERSAL_FLG** | `Nullable(String)` | Буцаалт хийгдсэн эсэх (`Y`=тийм) |
| **A_REV_REASON_CODE** | `Nullable(String)` | Буцаалтын шалтгааны код |
| **A_TRAN_DATE** | `Nullable(Date)` | Гүйлгээний огноо (A хэсэг) |
| **A_TRAN_ID** | `Nullable(String)` | Гүйлгээний дугаар (A хэсэг) |

| **B_ACCT_CRNCY_CODE** | `Nullable(String)` | Дансны үндсэн валютын код |
| **B_ACCT_PRTY_NUMBER** | `Nullable(String)` | Дансны эрэмбэ / давуу эрхийн дугаар |
| **B_ACCT_RATE** | `Nullable(Float32)` | Дансны ханш (суурь валют руу хөрвүүлэх) |
| **B_ADDRESS** | `Nullable(String)` | Нөгөө талын хаяг |
| **B_BANK** | `Nullable(String)` | Нөгөө талын банкны нэр |
| **B_CHANNEL_ID** | `Nullable(String)` | Гүйлгээ хийгдсэн суваг (ж: Internet, Branch) |
| **B_CUSTNAME** | `Nullable(String)` | Хүлээн авагч / нөгөө талын харилцагчийн нэр |
| **B_D_IN_OUT_IND** | `Nullable(String)` | Дотоод/гадаад чиглэлийн тэмдэглэгээ |
| **B_IN_OUT_IND** | `Nullable(String)` | Орлого/зарлагын төрөл (`C`=орлого, `D`=зарлага) |
| **B_PAYSYS_ID** | `Nullable(String)` | Төлбөрийн системийн код |
| **B_REMITINFO** | `Nullable(String)` | Гүйлгээний утга / зориулалтын тайлбар |
| **B_STATUS** | `Nullable(String)` | Гүйлгээний төлөв |
| **B_TABLE_TYPE** | `Nullable(String)` | Хүснэгтийн төрөл (B хэсэг) |
| **B_TRAN_RATE** | `Nullable(Float32)` | Гүйлгээний ханш |
| **B_TYPE** | `Nullable(String)` | Гүйлгээний төрөл |
| **H_ACID** | `Nullable(String)` | Гүйлгээ хийгдсэн дансны дотоод дугаар |
| **H_AMT_RESERVATION_IND** | `Nullable(String)` | Дүн нөөцлөгдсөн эсэх |
| **H_BANK_CODE** | `Nullable(String)` | Банкны код |
| **H_BANK_ID** | `Nullable(String)` | Банкны системийн код |
| **H_BKDT_TRAN_FLG** | `Nullable(String)` | Банкны огноогоор бүртгэсэн гүйлгээ эсэх |
| **H_BR_CODE** | `Nullable(String)` | Салбарын код |
| **H_CRNCY_CODE** | `Nullable(String)` | Гүйлгээний валютын код |
| **H_CRNCY_HOL_CHK_DONE_FLG** | `Nullable(String)` | Валютын амралтын шалгалт хийгдсэн эсэх |
| **H_CUST_ID** | `Nullable(String)` | Харилцагчийн код |
| **H_DEL_FLG** | `Nullable(String)` | Устгасан эсэх (`Y`=устгасан) |
| **H_DEL_MEMO_PAD** | `Nullable(String)` | Тэмдэглэл устгасан эсэх |
| **H_DTH_INIT_SOL_ID** | `Nullable(String)` | Гүйлгээг эхлүүлсэн салбарын код |
| **H_ENTRY_DATE** | `Nullable(DateTime)` | Гүйлгээ оруулсан огноо, цаг |
| **H_ENTRY_USER_ID** | `Nullable(String)` | Гүйлгээ оруулсан хэрэглэгч |
| **H_FX_TRAN_AMT** | `Nullable(Float32)` | Гадаад валютын гүйлгээний дүн |
| **H_GL_DATE** | `Nullable(Date)` | Нягтлан бодох бүртгэлийн огноо |
| **H_GL_SUB_HEAD_CODE** | `Nullable(String)` | Ерөнхий дансны дэд код |
| **H_INSTRMNT_DATE** | `Nullable(Date)` | Төлбөрийн хэрэгслийн огноо |
| **H_INSTRMNT_NUM** | `Nullable(String)` | Төлбөрийн хэрэгслийн дугаар |
| **H_INSTRMNT_TYPE** | `Nullable(String)` | Төлбөрийн хэрэгслийн төрөл |
| **H_LCHG_TIME** | `Nullable(DateTime)` | Сүүлд өөрчилсөн огноо, цаг |
| **H_LCHG_USER_ID** | `Nullable(String)` | Сүүлд өөрчилсөн хэрэглэгч |
| **H_MODULE_ID** | `Nullable(String)` | Системийн модуль (ж: CASA, LOAN) |
| **H_PART_TRAN_SRL_NUM** | `Nullable(String)` | Гүйлгээний хэсгийн дугаар |
| **H_PART_TRAN_TYPE** | `Nullable(String)` | Гүйлгээний төрөл (`C`=орлого, `D`=зарлага) |
| **H_PRINCIPAL_PORTION_AMT** | `Nullable(Float32)` | Үндсэн дүнгийн хэсэг |
| **H_PSTD_DATE** | `Nullable(DateTime)` | Гүйлгээ батлагдсан огноо, цаг |
| **H_PSTD_FLG** | `Nullable(String)` | Батлагдсан эсэх (`Y`=тийм) |
| **H_PSTD_USER_ID** | `Nullable(String)` | Баталсан хэрэглэгч |
| **H_RATE** | `Nullable(Float32)` | Ханш |
| **H_REF_NUM** | `Nullable(String)` | Гүйлгээний лавлагааны дугаар |
| **H_RESERVATION_AMT** | `Nullable(Float32)` | Нөөцлөгдсөн дүн |
| **H_REVERSAL_DATE** | `Nullable(Date)` | Буцаалтын огноо |
| **H_SOL_ID** | `Nullable(String)` | Гүйлгээ хийсэн салбарын код |
| **H_TRAN_AMT** | `Nullable(Float32)` | Гүйлгээний дүн |
| **H_TRAN_CRNCY_CODE** | `Nullable(String)` | Гүйлгээний валют |
| **H_TRAN_DATE** | `Date` | Гүйлгээ хийгдсэн огноо |
| **H_TRAN_ID** | `String` | Гүйлгээний давтагдашгүй дугаар |
| **H_TRAN_PARTICULAR** | `Nullable(String)` | Гүйлгээний үндсэн тайлбар |
| **H_TRAN_PARTICULAR_2** | `Nullable(String)` | Гүйлгээний нэмэлт тайлбар |
| **H_TRAN_RMKS** | `Nullable(String)` | Гүйлгээний тэмдэглэл |
| **H_TRAN_TYPE** | `Nullable(String)` | Гүйлгээний төрөл |
| **H_TR_STATUS** | `Nullable(String)` | Гүйлгээний төлөв |
| **H_TS_CNT** | `Nullable(Float32)` | Цагийн тэмдэглэлийн тоолуур |
| **H_VALUE_DATE** | `Nullable(Date)` | Гүйлгээний үнэ цэнийн огноо |
| **H_VFD_DATE** | `Nullable(DateTime)` | Гүйлгээг шалгасан огноо, цаг |
| **H_VFD_USER_ID** | `Nullable(String)` | Гүйлгээг шалгасан хэрэглэгч |
| **H_VOUCHER_PRINT_FLG** | `Nullable(String)` | Баримт хэвлэх эсэх (`Y`=тийм) |
| **H_TRAN_SUB_TYPE** | `Nullable(String)` | Гүйлгээний дэд төрөл |
| **H_RPT_CODE** | `Nullable(String)` | Тайлангийн код |
| **H_INSTRMNT_ALPHA** | `Nullable(String)` | Санхүүгийн хэрэгслийн хувьсагч тэмдэгт |
| **H_PRNT_ADVC_IND** | `Nullable(String)` | Зөвлөмж хэвлэх үзүүлэлт |
| **H_RESTRICT_MODIFY_IND** | `Nullable(String)` | Өөрчлөлт хязгаарлах үзүүлэлт |
| **H_RCRE_USER_ID** | `Nullable(String)` | Гүйлгээ бүртгэсэн хэрэглэгчийн дугаар |
| **H_RCRE_TIME** | `Nullable(DateTime)` | Гүйлгээ бүртгэгдсэн цаг |
| **H_RATE_CODE** | `Nullable(String)` | Гүйлгээний хүүгийн хувийн код |
| **H_NAVIGATION_FLG** | `Nullable(String)` | Навигацын тэмдэглэгч |
| **H_REF_CRNCY_CODE** | `Nullable(String)` | Лавлах валютын код |
| **H_REF_AMT** | `Nullable(Float32)` | Лавлах валютаар илэрхийлсэн дүн |
| **H_TREA_REF_NUM** | `Nullable(String)` | Захиргааны лавлах дугаар |
| **H_TREA_RATE** | `Nullable(Float32)` | Захиргааны ханш |
| **H_GST_UPD_FLG** | `Nullable(String)` | НӨАТ шинэчлэлтийн тэмдэглэгч |
| **H_ISO_FLG** | `Nullable(String)` | ISO стандартын тэмдэглэгч |
| **H_EABFAB_UPD_FLG** | `Nullable(String)` | EABFAB системийн шинэчлэлтийн тэмдэглэгч |
| **H_LIFT_LIEN_FLG** | `Nullable(String)` | Лиен (барьцаа) тайлах тэмдэглэгч |
| **H_PROXY_POST_IND** | `Nullable(String)` | Прокси дансаар нийтлэх үзүүлэлт |
| **H_SI_SRL_NUM** | `Nullable(String)` | Байнгын даалгаварын дэс дугаар |
| **H_SI_ORG_EXEC_DATE** | `Nullable(Date)` | Байнгын даалгаварын анхны гүйцэтгэлийн огноо |
| **H_PR_SRL_NUM** | `Nullable(String)` | Хэсэгчилсэн буцаалтын дарааллын дугаар |
| **H_SERIAL_NUM** | `Nullable(String)` | Гүйлгээний дэс дугаар |
| **H_UAD_MODULE_ID** | `Nullable(String)` | UAD модулийн дугаар |
| **H_UAD_MODULE_KEY** | `Nullable(String)` | UAD модулийн түлхүүр |
| **H_REVERSAL_VALUE_DATE** | `Nullable(Date)` | Буцаалтын хүчин төгөлдөр огноо |
| **H_PTTM_EVENT_TYPE** | `Nullable(String)` | PTTM модулийн үйл явдлын төрөл |
| **H_PROXY_ACID** | `Nullable(String)` | Прокси дансны дугаар |
| **H_TOD_ENTITY_TYPE** | `Nullable(String)` | TOD аж ахуйн нэгжийн төрөл |
| **H_TOD_ENTITY_ID** | `Nullable(String)` | TOD аж ахуйн нэгжийн дугаар |
| **H_REGULARIZATION_AMT** | `Nullable(Float32)` | Тохируулгын гүйлгээний дүн |
| **H_TF_ENTITY_SOL_ID** | `Nullable(String)` | TF аж ахуйн нэгжийн нэгжийн дугаар |
| **H_TRAN_PARTICULAR_CODE** | `Nullable(String)` | Гүйлгээний тодотгол код |
| **H_SVS_TRAN_ID** | `Nullable(String)` | SVS системийн гүйлгээний дугаар |
| **H_REFERRAL_ID** | `Nullable(String)` | Зуучлалын дугаар |
| **H_PARTY_CODE** | `Nullable(String)` | Гүйлгээний этгээдийн код |
| **H_IMPL_CASH_PART_TRAN_FLG** | `Nullable(String)` | Далд бэлэн мөнгөний хэсэгчилсэн гүйлгээний тэмдэглэгч |
| **H_PTRAN_CHRG_EXISTS_FLG** | `Nullable(String)` | Хэсэгчилсэн гүйлгээний хэмжилт байгаа эсэх тэмдэглэгч |
| **H_MUD_POOL_BAL_BUILD_FLG** | `Nullable(String)` | MUD сангийн үлдэгдэл бүрдүүлэх тэмдэглэгч |
| **H_GL_SEGMENT_STRING** | `Nullable(String)` | Ерөнхий дэвтрийн сегментийн нийлсэн мөр |

<br>

### 📋 `HTD_ATD_CURRENT` (113 багана, 44 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **A_ACCT_TRANSFER_FLG** | `Nullable(String)` | Данс хооронд шилжүүлэг хийгдсэн эсэх (`Y`=тийм) |
| **A_BANK_ID** | `Nullable(String)` | Банкны системийн код (A хэсэг) |
| **A_CONT_PART_TRAN_SRL_NUM** | `Nullable(String)` | Холбоотой хэсэгчилсэн гүйлгээний дарааллын дугаар |
| **A_CONT_TRAN_DATE** | `Nullable(Date)` | Холбоотой гүйлгээний огноо |
| **A_CONT_TRAN_ID** | `Nullable(String)` | Холбоотой гүйлгээний дугаар |
| **A_PART_TRAN_SRL_NUM** | `Nullable(String)` | Хэсэгчилсэн гүйлгээний дарааллын дугаар |
| **A_REVERSAL_COMMENTS** | `Nullable(String)` | Буцаалтын тайлбар |
| **A_REVERSAL_FLG** | `Nullable(String)` | Буцаалт хийгдсэн эсэх (`Y`=тийм) |
| **A_REV_REASON_CODE** | `Nullable(String)` | Буцаалтын шалтгааны код |
| **A_TRAN_DATE** | `Nullable(Date)` | Гүйлгээний огноо (A хэсэг) |
| **A_TRAN_ID** | `Nullable(String)` | Гүйлгээний дугаар (A хэсэг) |

| **B_ACCT_CRNCY_CODE** | `Nullable(String)` | Дансны валютын код |
| **B_ACCT_PRTY_NUMBER** | `Nullable(String)` | Дансны эрэмбэ / давуу эрхийн дугаар |
| **B_ACCT_RATE** | `Nullable(Float32)` | Дансны ханш (суурь валют руу хөрвүүлэх) |
| **B_ADDRESS** | `Nullable(String)` | Нөгөө талын хаяг |
| **B_BANK** | `Nullable(String)` | Нөгөө талын банкны нэр |
| **B_CHANNEL_ID** | `Nullable(String)` | Гүйлгээний суваг (ж: Internet, Branch) |
| **B_CUSTNAME** | `Nullable(String)` | Нөгөө талын харилцагчийн нэр |
| **B_D_IN_OUT_IND** | `Nullable(String)` | Дотоод/гадаад чиглэлийн тэмдэглэгээ |
| **B_IN_OUT_IND** | `Nullable(String)` | Орлого/зарлага (`C`=орлого, `D`=зарлага) |
| **B_PAYSYS_ID** | `Nullable(String)` | Төлбөрийн системийн код |
| **B_REMITINFO** | `Nullable(String)` | Гүйлгээний утга / зориулалт |
| **B_STATUS** | `Nullable(String)` | Гүйлгээний төлөв |
| **B_TABLE_TYPE** | `Nullable(String)` | Хүснэгтийн төрөл |
| **B_TRAN_RATE** | `Nullable(Float32)` | Гүйлгээний ханш |
| **B_TYPE** | `Nullable(String)` | Гүйлгээний төрөл |
| **H_ACID** | `Nullable(String)` | Гүйлгээ хийгдсэн дансны дотоод дугаар |
| **H_AMT_RESERVATION_IND** | `Nullable(String)` | Дүн нөөцлөгдсөн эсэх |
| **H_BANK_CODE** | `Nullable(String)` | Банкны код |
| **H_BANK_ID** | `Nullable(String)` | Банкны системийн код |
| **H_BKDT_TRAN_FLG** | `Nullable(String)` | Банкны огноогоор бүртгэсэн гүйлгээ эсэх |
| **H_BR_CODE** | `Nullable(String)` | Салбарын код |
| **H_CRNCY_CODE** | `Nullable(String)` | Гүйлгээний валют |
| **H_CUST_ID** | `Nullable(String)` | Харилцагчийн код |
| **H_ENTRY_DATE** | `Nullable(DateTime)` | Гүйлгээ оруулсан огноо, цаг |
| **H_ENTRY_USER_ID** | `Nullable(String)` | Гүйлгээ оруулсан хэрэглэгч |
| **H_FX_TRAN_AMT** | `Nullable(Float32)` | Гадаад валютын гүйлгээний дүн |
| **H_GL_DATE** | `Nullable(Date)` | Нягтлан бодох бүртгэлийн огноо |
| **H_GL_SUB_HEAD_CODE** | `Nullable(String)` | Ерөнхий дансны дэд код |
| **H_INSTRMNT_DATE** | `Nullable(Date)` | Төлбөрийн хэрэгслийн огноо |
| **H_INSTRMNT_NUM** | `Nullable(String)` | Төлбөрийн хэрэгслийн дугаар |
| **H_INSTRMNT_TYPE** | `Nullable(String)` | Төлбөрийн хэрэгслийн төрөл |
| **H_LCHG_TIME** | `Nullable(DateTime)` | Сүүлд өөрчилсөн огноо, цаг |
| **H_LCHG_USER_ID** | `Nullable(String)` | Сүүлд өөрчилсөн хэрэглэгч |
| **H_MODULE_ID** | `Nullable(String)` | Системийн модуль (ж: CASA, LOAN) |
| **H_PART_TRAN_SRL_NUM** | `Nullable(String)` | Гүйлгээний хэсгийн дугаар |
| **H_PART_TRAN_TYPE** | `Nullable(String)` | Гүйлгээний төрөл (`C`=орлого, `D`=зарлага) |
| **H_PSTD_DATE** | `Nullable(DateTime)` | Гүйлгээ батлагдсан огноо, цаг |
| **H_PSTD_FLG** | `Nullable(String)` | Батлагдсан эсэх (`Y`=тийм) |
| **H_PSTD_USER_ID** | `Nullable(String)` | Баталсан хэрэглэгч |
| **H_RATE** | `Nullable(Float32)` | Ханш |
| **H_REF_NUM** | `Nullable(String)` | Лавлагааны дугаар |
| **H_RESERVATION_AMT** | `Nullable(Float32)` | Нөөцлөгдсөн дүн |
| **H_REVERSAL_DATE** | `Nullable(Date)` | Буцаалтын огноо |
| **H_SOL_ID** | `Nullable(String)` | Салбарын код |
| **H_TRAN_AMT** | `Nullable(Float32)` | Гүйлгээний дүн |
| **H_TRAN_CRNCY_CODE** | `Nullable(String)` | Гүйлгээний валют |
| **H_TRAN_DATE** | `Date` | Гүйлгээ хийгдсэн огноо |
| **H_TRAN_ID** | `String` | Гүйлгээний давтагдашгүй дугаар |
| **H_TRAN_PARTICULAR** | `Nullable(String)` | Гүйлгээний үндсэн тайлбар |
| **H_TRAN_PARTICULAR_2** | `Nullable(String)` | Гүйлгээний нэмэлт тайлбар |
| **H_TRAN_RMKS** | `Nullable(String)` | Гүйлгээний тэмдэглэл |
| **H_TRAN_TYPE** | `Nullable(String)` | Гүйлгээний төрөл |
| **H_TR_STATUS** | `Nullable(String)` | Гүйлгээний төлөв |
| **H_TS_CNT** | `Nullable(Float32)` | Цагийн тэмдэглэлийн тоолуур |
| **H_VALUE_DATE** | `Nullable(Date)` | Гүйлгээний үнэ цэнийн огноо |
| **H_VFD_DATE** | `Nullable(DateTime)` | Гүйлгээг шалгасан огноо, цаг |
| **H_VFD_USER_ID** | `Nullable(String)` | Гүйлгээг шалгасан хэрэглэгч |
| **H_VOUCHER_PRINT_FLG** | `Nullable(String)` | Баримт хэвлэх эсэх (`Y`=тийм) |
| **H_DEL_FLG** | `Nullable(String)` | Устгагдсан эсэх тэмдэглэгч |
| **H_TRAN_SUB_TYPE** | `Nullable(String)` | Гүйлгээний дэд төрөл |
| **H_RPT_CODE** | `Nullable(String)` | Тайлангийн код |
| **H_INSTRMNT_ALPHA** | `Nullable(String)` | Санхүүгийн хэрэгслийн хувьсагч тэмдэгт |
| **H_PRNT_ADVC_IND** | `Nullable(String)` | Зөвлөмж хэвлэх үзүүлэлт |
| **H_RESTRICT_MODIFY_IND** | `Nullable(String)` | Өөрчлөлт хязгаарлах үзүүлэлт |
| **H_RCRE_USER_ID** | `Nullable(String)` | Гүйлгээ бүртгэсэн хэрэглэгчийн дугаар |
| **H_RCRE_TIME** | `Nullable(DateTime)` | Гүйлгээ бүртгэгдсэн цаг |
| **H_RATE_CODE** | `Nullable(String)` | Гүйлгээний хүүгийн хувийн код |
| **H_NAVIGATION_FLG** | `Nullable(String)` | Навигацын тэмдэглэгч |
| **H_REF_CRNCY_CODE** | `Nullable(String)` | Лавлах валютын код |
| **H_REF_AMT** | `Nullable(Float32)` | Лавлах валютаар илэрхийлсэн дүн |
| **H_TREA_REF_NUM** | `Nullable(String)` | Захиргааны лавлах дугаар |
| **H_TREA_RATE** | `Nullable(Float32)` | Захиргааны ханш |
| **H_GST_UPD_FLG** | `Nullable(String)` | НӨАТ шинэчлэлтийн тэмдэглэгч |
| **H_ISO_FLG** | `Nullable(String)` | ISO стандартын тэмдэглэгч |
| **H_EABFAB_UPD_FLG** | `Nullable(String)` | EABFAB системийн шинэчлэлтийн тэмдэглэгч |
| **H_LIFT_LIEN_FLG** | `Nullable(String)` | Лиен (барьцаа) тайлах тэмдэглэгч |
| **H_PROXY_POST_IND** | `Nullable(String)` | Прокси дансаар нийтлэх үзүүлэлт |
| **H_SI_SRL_NUM** | `Nullable(String)` | Байнгын даалгаварын дэс дугаар |
| **H_SI_ORG_EXEC_DATE** | `Nullable(Date)` | Байнгын даалгаварын анхны гүйцэтгэлийн огноо |
| **H_PR_SRL_NUM** | `Nullable(String)` | Хэсэгчилсэн буцаалтын дарааллын дугаар |
| **H_SERIAL_NUM** | `Nullable(String)` | Гүйлгээний дэс дугаар |
| **H_DEL_MEMO_PAD** | `Nullable(String)` | Устгалтын тэмдэглэлийн дэвтэр |
| **H_UAD_MODULE_ID** | `Nullable(String)` | UAD модулийн дугаар |
| **H_UAD_MODULE_KEY** | `Nullable(String)` | UAD модулийн түлхүүр |
| **H_REVERSAL_VALUE_DATE** | `Nullable(Date)` | Буцаалтын хүчин төгөлдөр огноо |
| **H_PTTM_EVENT_TYPE** | `Nullable(String)` | PTTM модулийн үйл явдлын төрөл |
| **H_PROXY_ACID** | `Nullable(String)` | Прокси дансны дугаар |
| **H_TOD_ENTITY_TYPE** | `Nullable(String)` | TOD аж ахуйн нэгжийн төрөл |
| **H_TOD_ENTITY_ID** | `Nullable(String)` | TOD аж ахуйн нэгжийн дугаар |
| **H_DTH_INIT_SOL_ID** | `Nullable(String)` | DTH гүйлгээ эхлүүлсэн нэгжийн дугаар |
| **H_REGULARIZATION_AMT** | `Nullable(Float32)` | Тохируулгын гүйлгээний дүн |
| **H_PRINCIPAL_PORTION_AMT** | `Nullable(Float32)` | Үндсэн зээлийн хэсгийн дүн |
| **H_TF_ENTITY_SOL_ID** | `Nullable(String)` | TF аж ахуйн нэгжийн нэгжийн дугаар |
| **H_TRAN_PARTICULAR_CODE** | `Nullable(String)` | Гүйлгээний тодотгол код |
| **H_SVS_TRAN_ID** | `Nullable(String)` | SVS системийн гүйлгээний дугаар |
| **H_CRNCY_HOL_CHK_DONE_FLG** | `Nullable(String)` | Валютын амралтын өдрийн шалгалт хийсэн тэмдэглэгч |
| **H_REFERRAL_ID** | `Nullable(String)` | Зуучлалын дугаар |
| **H_PARTY_CODE** | `Nullable(String)` | Гүйлгээний этгээдийн код |
| **H_IMPL_CASH_PART_TRAN_FLG** | `Nullable(String)` | Далд бэлэн мөнгөний хэсэгчилсэн гүйлгээний тэмдэглэгч |
| **H_PTRAN_CHRG_EXISTS_FLG** | `Nullable(String)` | Хэсэгчилсэн гүйлгээний хэмжилт байгаа эсэх тэмдэглэгч |
| **H_MUD_POOL_BAL_BUILD_FLG** | `Nullable(String)` | MUD сангийн үлдэгдэл бүрдүүлэх тэмдэглэгч |
| **H_GL_SEGMENT_STRING** | `Nullable(String)` | Ерөнхий дэвтрийн сегментийн нийлсэн мөр |


<br>


### 📋 `LHT` (6 багана, 6 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **ACID** | `String` | Дансны дотоод дугаар (ACID) |
| **RCRE_TIME** | `DateTime` | Бүртгэсэн огноо, цаг |
| **RCRE_USER_ID** | `Nullable(String)` | Бүртгэсэн хэрэглэгчийн ID |
| **SANCT_AUTH_CODE** | `Nullable(String)` | Баталгаажуулсан хэрэглэгчийн код |
| **SANCT_LEVL_CODE** | `Nullable(String)` | Баталгаажуулалтын түвшний код |
| **SOL_ID** | `Nullable(String)` | Салбарын код |


<br>


### 📋 `POR_HD` (63 багана, 20 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **B_BENBANKADDR** | `Nullable(String)` | Хүлээн авагч банкны хаяг |
| **B_BENBANKCODE** | `Nullable(String)` | Хүлээн авагч банкны код |
| **B_BENBANKNAME** | `Nullable(String)` | Хүлээн авагч банкны нэр |
| **B_BEN_ACCT_NAME** | `Nullable(String)` | Хүлээн авагчийн дансны нэр |
| **B_BEN_CIF_ID** | `Nullable(String)` | Хүлээн авагчийн CIF дугаар |
| **B_ORGBANKADDRESS** | `Nullable(String)` | Илгээгч банкны хаяг |
| **B_ORGBANKCODE** | `Nullable(String)` | Илгээгч банкны код |
| **B_ORGBANKNAME** | `Nullable(String)` | Илгээгч банкны нэр |
| **B_ORG_ACCT_NAME** | `Nullable(String)` | Илгээгчийн дансны нэр |
| **B_ORG_CIF_ID** | `Nullable(String)` | Илгээгчийн CIF дугаар |
| **B_OURCORRBANKADDRESS** | `Nullable(String)` | Манай корреспондент банкны хаяг |
| **B_OURCORRBANKCODE** | `Nullable(String)` | Манай корреспондент банкны код |
| **B_OURCORRBANKNAME** | `Nullable(String)` | Манай корреспондент банкны нэр |
| **B_RATE** | `Nullable(Float64)` | Гүйлгээний ханш |
| **B_REF_DESC** | `Nullable(String)` | Лавлагааны тайлбар |
| **D_AWI_BIC** | `Nullable(String)` | Хүлээн авагч банкны BIC код |
| **D_AWI_BNK_CD** | `Nullable(String)` | AWI банкны код |
| **D_AWI_BRANCH_CD** | `Nullable(String)` | AWI салбарын код |
| **D_BENEF_PRTY_ACCT** | `Nullable(String)` | Хүлээн авагчийн дансны дугаар |
| **D_BENEF_PRTY_ADDR1** | `Nullable(String)` | Хүлээн авагчийн хаяг 1 |
| **D_BENEF_PRTY_ADDR2** | `Nullable(String)` | Хүлээн авагчийн хаяг 2 |
| **D_BENEF_PRTY_ADDR3** | `Nullable(String)` | Хүлээн авагчийн хаяг 3 |
| **D_BENEF_PRTY_NAME** | `Nullable(String)` | Хүлээн авагчийн нэр |
| **D_CHARGE_OPTION** | `Nullable(String)` | Хураамж тооцох сонголт |
| **D_CHRG_EVENT_ID** | `Nullable(String)` | Хураамжийн үйл явдлын ID |
| **D_CR_EXCH_RATE_CD** | `Nullable(String)` | Кредит ханшийн код |
| **D_OUR_CORRESP_BIC** | `Nullable(String)` | Манай корреспондент банкны BIC код |
| **D_OUR_CORRESP_BNK_CD** | `Nullable(String)` | Манай корреспондент банкны код |
| **D_OUR_CORRESP_BRANCH_CD** | `Nullable(String)` | Манай корреспондент банкны салбарын код |
| **D_RECVR_BIC** | `Nullable(String)` | Хүлээн авагч банкны BIC код |
| **D_RECVR_BNK_CD** | `Nullable(String)` | Хүлээн авагч банкны код |
| **D_RECVR_BRANCH_CD** | `Nullable(String)` | Хүлээн авагч банкны салбарын код |
| **D_RECVR_CHRG_AMT** | `Nullable(Float64)` | Хүлээн авагч талаас төлөх хураамжийн дүн |
| **D_RECVR_CHRG_CRNCY** | `Nullable(String)` | Хүлээн авагчийн хураамжийн валют |
| **D_REGULATORY_INFO** | `Nullable(String)` | Зохицуулалтын мэдээлэл |
| **D_REMIT_AMT** | `Nullable(Float64)` | Шилжүүлгийн дүн |
| **D_REMIT_CRNCY** | `Nullable(String)` | Шилжүүлгийн валют |
| **D_REMIT_INFO** | `Nullable(String)` | Гүйлгээний утга / дэлгэрэнгүй мэдээлэл |
| **D_ROUTED_PAYSYS_ID** | `Nullable(String)` | Чиглүүлсэн төлбөрийн системийн ID |
| **D_SENDER_BIC** | `Nullable(String)` | Илгээгч банкны BIC код |
| **D_SENDER_CHRG_AMT** | `Nullable(Float64)` | Илгээгч талаас төлөх хураамжийн дүн |
| **D_SENDER_CHRG_CRNCY** | `Nullable(String)` | Илгээгчийн хураамжийн валют |
| **D_SENDER_TO_RECVR_INFO** | `Nullable(String)` | Илгээгчээс хүлээн авагчид өгөх мэдээлэл |
| **D_TOTAL_CHRG_AMT** | `Nullable(Float64)` | Нийт хураамжийн дүн |
| **D_TOTAL_CHRG_CRNCY** | `Nullable(String)` | Нийт хураамжийн валют |
| **H_BNK_ID** | `Nullable(String)` | Банкны ID |
| **H_LCHG_TIME** | `Nullable(Date)` | Сүүлд өөрчилсөн огноо |
| **H_LCHG_USER_ID** | `Nullable(String)` | Сүүлд өөрчилсөн хэрэглэгчийн ID |
| **H_ORD_PRTY_ACCT** | `Nullable(String)` | Илгээгчийн дансны дугаар |
| **H_ORD_PRTY_ADDR1** | `Nullable(String)` | Илгээгчийн хаяг 1 |
| **H_ORD_PRTY_ADDR2** | `Nullable(String)` | Илгээгчийн хаяг 2 |
| **H_ORD_PRTY_ADDR3** | `Nullable(String)` | Илгээгчийн хаяг 3 |
| **H_ORD_PRTY_NAME** | `Nullable(String)` | Илгээгчийн нэр |
| **H_PYMT_REF_NUM** | `Nullable(String)` | Төлбөрийн лавлагааны дугаар |
| **H_RCRE_TIME** | `Nullable(Date)` | Үүсгэсэн огноо |
| **H_RCRE_USER_ID** | `Nullable(String)` | Үүсгэсэн хэрэглэгчийн ID |
| **H_SOL_ID** | `Nullable(String)` | Салбарын код |
| **H_TOTAL_AMT** | `Nullable(Float32)` | Нийт гүйлгээний дүн |
| **H_TOTAL_AMT_CRNCY** | `Nullable(String)` | Нийт дүнгийн валют |
| **H_TRAN_DATE** | `Date` | Гүйлгээний огноо |
| **H_TRAN_ID** | `String` | Гүйлгээний давтагдашгүй дугаар |
| **H_TRAN_REF_NUM** | `Nullable(String)` | Гүйлгээний лавлагааны дугаар |
| **H_TS_CNT** | `Nullable(Float64)` | Цагийн тэмдэглэлийн тоолуур |


<br>


### 📋 `SOL` (49 багана, 21 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **ABBR_BANK_NAME** | `Nullable(String)` | Банкны товчилсон нэр |
| **ABBR_BR_NAME** | `Nullable(String)` | Салбарын товчилсон нэр |
| **ADDR_1** | `Nullable(String)` | Салбарын хаяг 1 |
| **ALL_SOL** | `Nullable(String)` | Бүх салбарт хамаарах эсэх тэмдэглэгээ |
| **BANK_CODE** | `Nullable(String)` | Банкны код |
| **BANK_ID** | `Nullable(String)` | Банкны системийн код |
| **BATCH_OPER_DATE** | `Nullable(Date)` | Багц гүйлгээний ажлын огноо |
| **BR_CODE** | `Nullable(String)` | Салбарын код |
| **CITY_CODE** | `Nullable(String)` | Хотын код |
| **CLG_CENTRE_NUM** | `Nullable(String)` | Клиринг төвийн дугаар |
| **CNTRY_CODE** | `Nullable(String)` | Улсын код |
| **CTS_ENABLED_FLG** | `Nullable(String)` | CTS идэвхтэй эсэх |
| **DATE_OF_INSTALLATION** | `Nullable(Date)` | Систем суурилуулсан огноо |
| **DB_STAT_CODE** | `Nullable(String)` | Өгөгдлийн сангийн төлөвийн код |
| **DEL_FLG** | `Nullable(String)` | Устгасан эсэх (`Y` = устгасан) |
| **EXTN_CNTR_CODE** | `Nullable(String)` | Нэмэлт тоолуурын код |
| **HOME_CRNCY_CODE** | `Nullable(String)` | Салбарын үндсэн валютын код |
| **H_DIVISION** | `Nullable(String)` | Хэлтэс |
| **H_MAIN_CLASS** | `Nullable(String)` | Үндсэн ангилал |
| **H_SUB_CLASS** | `Nullable(String)` | Дэд ангилал |
| **H_UNIT** | `Nullable(String)` | Нэгж |
| **KPI_SOL_ADDRESS** | `Nullable(String)` | KPI салбарын хаяг |
| **KPI_SOL_BUSINESS_UNIT** | `Nullable(String)` | KPI салбарын бизнесийн нэгж |
| **KPI_SOL_ID** | `Nullable(String)` | KPI салбарын ID |
| **KPI_SOL_NAME** | `Nullable(String)` | KPI салбарын нэр |
| **KPI_SOL_PRIORITY** | `Nullable(String)` | KPI салбарын тэргүүлэх чиглэл |
| **KPI_SOL_REGION** | `Nullable(String)` | KPI салбарын бүс |
| **LAST_INT_CALC_DATE_FOR_SB** | `Nullable(Date)` | Хадгаламжийн дансны сүүлд хүү тооцсон огноо |
| **LCHG_TIME** | `Nullable(DateTime)` | Сүүлд өөрчилсөн огноо, цаг |
| **LCHG_USER_ID** | `Nullable(String)` | Сүүлд өөрчилсөн хэрэглэгчийн ID |
| **MINOR_AGE** | `Nullable(Float32)` | Насанд хүрээгүйд тооцох насны дээд хязгаар |
| **PARTITION_ALIAS** | `Nullable(String)` | Хуваалтын товчилсон нэр |
| **PIN_CODE** | `Nullable(String)` | Шуудангийн индекс |
| **RCRE_TIME** | `Date` | Үүсгэсэн огноо |
| **RCRE_USER_ID** | `Nullable(String)` | Үүсгэсэн хэрэглэгчийн ID |
| **REFERRAL_SET_ID** | `Nullable(String)` | Лавлагааны тохиргооны ID |
| **SOL_ALIAS** | `Nullable(String)` | Салбарын товчилсон нэр |
| **SOL_BOD_DATE** | `Nullable(Date)` | Салбарын ажлын өдрийн огноо |
| **SOL_CLS_DATE** | `Nullable(Date)` | Салбар хаагдсан огноо |
| **SOL_CLS_FLG** | `Nullable(String)` | Салбар хаагдсан эсэх |
| **SOL_DESC** | `Nullable(String)` | Салбарын нэр |
| **SOL_ID** | `String` | Салбарын код |
| **SOL_NAT_FLG** | `Nullable(String)` | Үндэсний түвшний салбар эсэх |
| **SOL_PRIORITY** | `Nullable(Float32)` | Салбарын тэргүүлэх зэрэглэл |
| **SOL_RESTARTABILITY_FLG** | `Nullable(String)` | Салбарыг дахин нээх боломжтой эсэх |
| **STATE_CODE** | `Nullable(String)` | Аймаг / мужийн код |
| **TIME_ZONE** | `Nullable(String)` | Цагийн бүс |
| **WKLY_OFF** | `Nullable(Float32)` | Долоо хоногийн амралтын 1 дэх өдөр |
| **WKLY_OFF2** | `Nullable(Float32)` | Долоо хоногийн амралтын 2 дахь өдөр |


## 🗄️ `CARDZONE`

### 📋 `CZ_AUTHTXN` (110 багана, 110 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **AUTHTXN_NO** | `Float64` | Зөвшөөрлийн гүйлгээний давтагдашгүй дугаар |
| **AUTHTXN_POST_DATE** | `Nullable(Date)` | Гүйлгээ системд бүртгэгдсэн огноо |
| **AUTHTXN_SYSTEM_ID** | `Nullable(String)` | Гүйлгээ үүссэн системийн ID |
| **AUTHTXN_TXNTYPE_ID** | `Nullable(String)` | Гүйлгээний төрлийн ID |
| **AUTHTXN_MATCH_PREVTXN_IND** | `Nullable(String)` | Өмнөх гүйлгээтэй холбогдсон эсэх (`Y`=тийм) |
| **AUTHTXN_CARD_NO** | `Nullable(String)` | Картын дугаар |
| **AUTHTXN_CARD_NO_TO** | `Nullable(String)` | Хүлээн авагчийн картын дугаар |
| **AUTHTXN_REQUEST_AMT** | `Nullable(Float64)` | Гүйлгээний хүсэлтээр илгээсэн дүн |
| **AUTHTXN_APPROVED_AMT** | `Nullable(Float64)` | Банкнаас зөвшөөрсөн дүн |
| **AUTHTXN_STAN** | `Nullable(String)` | Системийн дарааллын дугаар (STAN) |
| **AUTHTXN_PREV_STAN** | `Nullable(String)` | Өмнөх гүйлгээний STAN |
| **AUTHTXN_TRANS_DATETIME** | `Nullable(String)` | Гүйлгээний огноо, цаг (string формат) |
| **AUTHTXN_TRXN_DATE** | `Nullable(String)` | Гүйлгээний огноо |
| **AUTHTXN_TRXN_TIME** | `Nullable(String)` | Гүйлгээний цаг |
| **AUTHTXN_REQUEST_DATE** | `Date` | Хүсэлт ирсэн огноо |
| **AUTHTXN_REQUEST_TIME** | `Nullable(String)` | Хүсэлт ирсэн цаг |
| **AUTHTXN_CARDHOLDER_NAME** | `Nullable(String)` | Карт эзэмшигчийн нэр |
| **AUTHTXN_CARD_EXPIRY_DATE** | `Nullable(String)` | Картын хүчинтэй хугацаа |
| **AUTHTXN_POS_COND_CODE** | `Nullable(String)` | POS гүйлгээний нөхцлийн код |
| **AUTHTXN_POS_ENTRY_MODE** | `Nullable(String)` | Карт уншсан арга (chip, swipe, online) |
| **AUTHTXN_TRACK2_DATA** | `Nullable(String)` | Картын Track2 өгөгдөл |
| **AUTHTXN_RETRIEVAL_REFNO** | `Nullable(String)` | Гүйлгээний лавлагааны дугаар |
| **AUTHTXN_OLD_RETRIEVAL_REFNO** | `Nullable(String)` | Өмнөх лавлагааны дугаар |
| **AUTHTXN_APPROVAL_CODE** | `Nullable(String)` | Зөвшөөрлийн код |
| **AUTHTXN_DECISION_CODE** | `Nullable(String)` | Банкны шийдвэрийн код |
| **AUTHTXN_RESPONSE_CODE** | `Nullable(String)` | Хариу код (`00`=амжилттай) |
| **AUTHTXN_REFERRAL_CODE** | `Nullable(String)` | Шилжүүлэлтийн код |
| **AUTHTXN_MERCHANT_ID** | `Nullable(String)` | Худалдааны газрын ID |
| **AUTHTXN_TERMINAL_ID** | `Nullable(String)` | POS терминалын ID |
| **AUTHTXN_MERCHANT_NAME** | `Nullable(String)` | Худалдааны газрын нэр |
| **AUTHTXN_COUNTRY_CODE** | `Nullable(String)` | Гүйлгээ хийгдсэн улсын код |
| **AUTHTXN_TERMINAL_BATCH_NO** | `Nullable(String)` | Терминалын batch дугаар |
| **AUTHTXN_HOST_BATCH_NO** | `Nullable(String)` | Хост системийн batch дугаар |
| **AUTHTXN_TERMINAL_INVOICE_NO** | `Nullable(String)` | Терминалын нэхэмжлэлийн дугаар |
| **AUTHTXN_CURRENCY_CODE** | `Nullable(String)` | Гүйлгээний валютын код |
| **AUTHTXN_MCC_ID** | `Nullable(String)` | Худалдааны ангиллын код (MCC) |
| **AUTHTXN_CONV_MCC_ID** | `Nullable(String)` | Хөрвүүлсэн MCC код |
| **AUTHTXN_RESPONSE_DATE** | `Nullable(DateTime)` | Хариу өгсөн огноо |
| **AUTHTXN_RESPONSE_TIME** | `Nullable(String)` | Хариу өгсөн цаг |
| **AUTHTXN_SETTLED_IND** | `Nullable(String)` | Төлбөр тооцоо хийгдсэн эсэх (`Y`=тийм) |
| **AUTHTXN_SETTLED_DATE** | `Nullable(DateTime)` | Төлбөр тооцоо хийгдсэн огноо |
| **AUTHTXN_SETTLED_CURRENCY_RATE** | `Nullable(String)` | Тооцооны ханш |
| **AUTHTXN_AUTO_EXPIRY_DATE** | `Nullable(DateTime)` | Автомат хүчингүй болох огноо |
| **AUTHTXN_DRIVER_PAN** | `Nullable(String)` | Флит картын жолоочийн картын дугаар |
| **AUTHTXN_ODO_VALUE** | `Nullable(String)` | Одометрийн утга (флит карт) |
| **AUTHTXN_CUST_ID** | `Nullable(String)` | Харилцагчийн ID |
| **AUTHTXN_SUBSIDY_REBATE_AMT** | `Nullable(Float64)` | Татаас, хөнгөлөлтийн дүн |
| **AUTHTXN_NET_AMT** | `Nullable(Float64)` | Цэвэр гүйлгээний дүн |
| **AUTHTXN_MERC_MDR_AMT** | `Nullable(Float64)` | Merchant MDR шимтгэл |
| **AUTHTXN_MERC_COMM_AMT** | `Nullable(Float64)` | Merchant комисс |
| **AUTHTXN_LAST_UPDATE_DATE** | `Nullable(String)` | Сүүлд шинэчлэгдсэн огноо |
| **AUTHTXN_LAST_UPDATE_TIME** | `Nullable(String)` | Сүүлд шинэчлэгдсэн цаг |
| **AUTHTXN_PROCESSEDBY** | `Nullable(String)` | Гүйлгээг боловсруулсан систем/хэрэглэгч |
| **AUTHTXN_SOURCE** | `Nullable(String)` | Гүйлгээ үүссэн систем |
| **AUTHTXN_SOURCE_BIZMODE** | `Nullable(String)` | Эх системийн бизнес горим |
| **AUTHTXN_DEST** | `Nullable(String)` | Гүйлгээ очих систем |
| **AUTHTXN_DEST_BIZMODE** | `Nullable(String)` | Зорилтот системийн бизнес горим |
| **AUTHTXN_TYPE** | `Nullable(String)` | Гүйлгээний төрөл |
| **AUTHTXN_ISSACQ_CODE** | `Nullable(String)` | Issuer / Acquirer код |
| **AUTHTXN_INTERCHG_IND** | `Nullable(String)` | Interchange гүйлгээ эсэх |
| **AUTHTXN_INTERBRANCH_IND** | `Nullable(String)` | Салбар хоорондын гүйлгээ эсэх |
| **AUTHTXN_GEOGRAPHY_IND** | `Nullable(String)` | Дотоод / гадаад гүйлгээ |
| **AUTHTXN_BONUS** | `Nullable(Float64)` | Урамшууллын дүн |
| **AUTHTXN_FEE** | `Nullable(Float64)` | Шимтгэлийн дүн |
| **AUTHTXN_CHARGE_AT_IND** | `Nullable(String)` | Шимтгэл тооцох эсэх |
| **AUTHTXN_USG_UPDATE_IND** | `Nullable(String)` | Ашиглалтын мэдээлэл шинэчлэгдсэн эсэх |
| **AUTHTXN_ACQ_CHARGE_AT_IND** | `Nullable(String)` | Acquirer шимтгэл тооцох эсэх |
| **AUTHTXN_BILLING_CURRENCY_ID** | `Nullable(String)` | Тооцооны валют |
| **AUTHTXN_BILLING_TXN_AMT** | `Nullable(Float64)` | Тооцооны гүйлгээний дүн |
| **AUTHTXN_BILLING_CURRENCY_RATE** | `Nullable(String)` | Тооцооны ханш |
| **AUTHTXN_CURRENCY_DATE** | `Nullable(String)` | Валютын ханшийн огноо |
| **AUTHTXN_CRDACCT_NO** | `Nullable(String)` | Картын дансны дугаар |
| **AUTHTXN_CRDACCT_NO_TO** | `Nullable(String)` | Хүлээн авагчийн дансны дугаар |
| **AUTHTXN_POST_IND** | `Nullable(String)` | Бүртгэгдсэн эсэх (`Y`=тийм) |
| **AUTHTXN_COMPONENT_ID** | `Nullable(String)` | Системийн бүрэлдэхүүний ID |
| **AUTHTXN_ACQ_COMPONENT_ID** | `Nullable(String)` | Acquirer бүрэлдэхүүний ID |
| **AUTHTXN_ACQ_INST_ID** | `Nullable(String)` | Acquiring байгууллагын ID |
| **AUTHTXN_MTI** | `Nullable(String)` | ISO мессежийн төрлийн код |
| **AUTHTXN_PROC_CD** | `Nullable(String)` | Боловсруулалтын код |
| **AUTHTXN_CRDPLAN_ID** | `Nullable(String)` | Картын тариф төлөвлөгөөний ID |
| **AUTHTXN_CRDBRAND_ID** | `Nullable(String)` | Картын брэнд (Visa, Master) |
| **AUTHTXN_BATCH_REF_SERIAL** | `Nullable(Float64)` | Batch лавлагааны дугаар |
| **AUTHTXN_BONUS_POINT** | `Nullable(Float64)` | Урамшууллын оноо |
| **AUTHTXN_TERMBONUS_POINT** | `Nullable(Float64)` | Терминалын урамшууллын оноо |
| **AUTHTXN_LOYALTY_REMARKS** | `Nullable(String)` | Урамшууллын тайлбар |
| **AUTHTXN_FLOOR_LIMIT** | `Nullable(Float64)` | Offline зөвшөөрлийн дээд хязгаар |
| **AUTHTXN_PURCHASE_CODE** | `Nullable(String)` | Худалдан авалтын код |
| **AUTHTXN_REFERRAL_REF** | `Nullable(String)` | Referral лавлагаа |
| **AUTHTXN_FRAUD_CHECK** | `Nullable(String)` | Fraud шалгалтын үр дүн |
| **AUTHTXN_NOTIF_CHECK** | `Nullable(String)` | Notification шалгалт |
| **AUTHTXN_SUBSIDY_REBATE_QTY** | `Nullable(Float64)` | Татааст барааны тоо хэмжээ |
| **AUTHTXN_MCCGROUP_ID** | `Nullable(String)` | MCC бүлэг |
| **AUTHTXN_MERC_GROUP_ID** | `Nullable(String)` | Merchant бүлэг |
| **AUTHTXN_TXNTYPGRP_ID** | `Nullable(String)` | Гүйлгээний төрлийн бүлэг |
| **AUTHTXN_VTXNTYPGRP_ID** | `Nullable(String)` | Virtual гүйлгээний бүлэг |
| **AUTHTXN_TXN_ENTRY_MODE** | `Nullable(String)` | Гүйлгээ оруулах арга |
| **AUTHTXN_MERC_SLSREGION_ID** | `Nullable(String)` | Merchant борлуулалтын бүс |
| **AUTHTXN_MERC_SLSAREA_ID** | `Nullable(String)` | Merchant борлуулалтын талбай |
| **AUTHTXN_CNTRYGRP_ID** | `Nullable(String)` | Улсын бүлэг |
| **AUTHTXN_FWD_INST_ID** | `Nullable(String)` | Дамжуулах байгууллага |
| **AUTHTXN_STMT_INC_BONUS** | `Nullable(Float64)` | Хуулгад орсон бонус |
| **AUTHTXN_STMT_INC_FEE** | `Nullable(Float64)` | Хуулгад орсон шимтгэл |
| **AUTHTXN_STMT_INC_COST** | `Nullable(Float64)` | Хуулгад орсон зардал |
| **AUTHTXN_STMT_INC_COMM** | `Nullable(Float64)` | Хуулгад орсон комисс |
| **AUTHTXN_CARD_SEQ_NO** | `Nullable(String)` | Картын дарааллын дугаар |
| **AUTHTXN_FOREX_MARKUP_AMT** | `Nullable(Float64)` | Валютын нэмэгдэл шимтгэл |
| **AUTHTXN_AUTO_RELOAD_AMT** | `Nullable(Float64)` | Автомат цэнэглэлтийн дүн |
| **AUTHTXN_VS_TRXN_ID** | `Nullable(String)` | Visa гүйлгээний ID |
| **ACQUIRERID** | `Nullable(String)` | Acquiring банк |
| **ISSUERID** | `Nullable(String)` | Issuing банк |

<br>


### 📋 `CZ_AUTHTXN_CURRENT` (110 багана, 110 нь тайлбартай)


| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **AUTHTXN_NO** | `Float32` | Зөвшөөрлийн гүйлгээний давтагдашгүй дугаар |
| **AUTHTXN_POST_DATE** | `Date` | Гүйлгээ системд бүртгэгдсэн огноо |
| **AUTHTXN_SYSTEM_ID** | `Nullable(String)` | Гүйлгээ үүссэн системийн ID |
| **AUTHTXN_TXNTYPE_ID** | `Nullable(String)` | Гүйлгээний төрлийн ID |
| **AUTHTXN_MATCH_PREVTXN_IND** | `Nullable(String)` | Өмнөх гүйлгээтэй холбогдсон эсэх (`Y`=тийм) |
| **AUTHTXN_CARD_NO** | `Nullable(String)` | Картын дугаар |
| **AUTHTXN_CARD_NO_TO** | `Nullable(String)` | Хүлээн авагчийн картын дугаар |
| **AUTHTXN_REQUEST_AMT** | `Nullable(Float32)` | Гүйлгээний хүсэлтээр илгээсэн дүн |
| **AUTHTXN_APPROVED_AMT** | `Nullable(Float32)` | Банкнаас зөвшөөрсөн дүн |
| **AUTHTXN_STAN** | `Nullable(String)` | Системийн дарааллын дугаар (STAN) |
| **AUTHTXN_PREV_STAN** | `Nullable(String)` | Өмнөх гүйлгээний STAN |
| **AUTHTXN_TRANS_DATETIME** | `Nullable(String)` | Гүйлгээний огноо, цаг (string формат) |
| **AUTHTXN_TRXN_DATE** | `Nullable(String)` | Гүйлгээний огноо |
| **AUTHTXN_TRXN_TIME** | `Nullable(String)` | Гүйлгээний цаг |
| **AUTHTXN_REQUEST_DATE** | `Nullable(DateTime)` | Хүсэлт ирсэн огноо, цаг |
| **AUTHTXN_REQUEST_TIME** | `Nullable(String)` | Хүсэлт ирсэн цаг |
| **AUTHTXN_CARDHOLDER_NAME** | `Nullable(String)` | Карт эзэмшигчийн нэр |
| **AUTHTXN_CARD_EXPIRY_DATE** | `Nullable(String)` | Картын хүчинтэй хугацаа |
| **AUTHTXN_POS_COND_CODE** | `Nullable(String)` | POS гүйлгээний нөхцлийн код |
| **AUTHTXN_POS_ENTRY_MODE** | `Nullable(String)` | Карт уншсан арга (chip, swipe, online) |
| **AUTHTXN_TRACK2_DATA** | `Nullable(String)` | Картын Track2 өгөгдөл |
| **AUTHTXN_RETRIEVAL_REFNO** | `Nullable(String)` | Гүйлгээний лавлагааны дугаар |
| **AUTHTXN_OLD_RETRIEVAL_REFNO** | `Nullable(String)` | Өмнөх лавлагааны дугаар |
| **AUTHTXN_APPROVAL_CODE** | `Nullable(String)` | Зөвшөөрлийн код |
| **AUTHTXN_DECISION_CODE** | `Nullable(String)` | Банкны шийдвэрийн код |
| **AUTHTXN_RESPONSE_CODE** | `Nullable(String)` | Хариу код (`00`=амжилттай) |
| **AUTHTXN_REFERRAL_CODE** | `Nullable(String)` | Шилжүүлэлтийн код |
| **AUTHTXN_MERCHANT_ID** | `Nullable(String)` | Худалдааны газрын ID |
| **AUTHTXN_TERMINAL_ID** | `Nullable(String)` | POS терминалын ID |
| **AUTHTXN_MERCHANT_NAME** | `Nullable(String)` | Худалдааны газрын нэр |
| **AUTHTXN_COUNTRY_CODE** | `Nullable(String)` | Гүйлгээ хийгдсэн улсын код |
| **AUTHTXN_TERMINAL_BATCH_NO** | `Nullable(String)` | Терминалын batch дугаар |
| **AUTHTXN_HOST_BATCH_NO** | `Nullable(String)` | Хост системийн batch дугаар |
| **AUTHTXN_TERMINAL_INVOICE_NO** | `Nullable(String)` | Терминалын нэхэмжлэлийн дугаар |
| **AUTHTXN_CURRENCY_CODE** | `Nullable(String)` | Гүйлгээний валютын код |
| **AUTHTXN_MCC_ID** | `Nullable(String)` | Худалдааны ангиллын код (MCC) |
| **AUTHTXN_CONV_MCC_ID** | `Nullable(String)` | Хөрвүүлсэн MCC код |
| **AUTHTXN_RESPONSE_DATE** | `Nullable(DateTime)` | Хариу өгсөн огноо |
| **AUTHTXN_RESPONSE_TIME** | `Nullable(String)` | Хариу өгсөн цаг |
| **AUTHTXN_SETTLED_IND** | `Nullable(String)` | Төлбөр тооцоо хийгдсэн эсэх (`Y`=тийм) |
| **AUTHTXN_SETTLED_DATE** | `Nullable(DateTime)` | Төлбөр тооцоо хийгдсэн огноо |
| **AUTHTXN_SETTLED_CURRENCY_RATE** | `Nullable(String)` | Тооцооны ханш |
| **AUTHTXN_AUTO_EXPIRY_DATE** | `Nullable(DateTime)` | Автомат хүчингүй болох огноо |
| **AUTHTXN_DRIVER_PAN** | `Nullable(String)` | Флит картын жолоочийн картын дугаар |
| **AUTHTXN_ODO_VALUE** | `Nullable(String)` | Одометрийн утга (флит карт) |
| **AUTHTXN_CUST_ID** | `Nullable(String)` | Харилцагчийн ID |
| **AUTHTXN_SUBSIDY_REBATE_AMT** | `Nullable(Float32)` | Татаас, хөнгөлөлтийн дүн |
| **AUTHTXN_NET_AMT** | `Nullable(Float32)` | Цэвэр гүйлгээний дүн |
| **AUTHTXN_MERC_MDR_AMT** | `Nullable(Float32)` | Merchant MDR шимтгэл |
| **AUTHTXN_MERC_COMM_AMT** | `Nullable(Float32)` | Merchant комисс |
| **AUTHTXN_LAST_UPDATE_DATE** | `Nullable(String)` | Сүүлд шинэчлэгдсэн огноо |
| **AUTHTXN_LAST_UPDATE_TIME** | `Nullable(String)` | Сүүлд шинэчлэгдсэн цаг |
| **AUTHTXN_PROCESSEDBY** | `Nullable(String)` | Гүйлгээг боловсруулсан систем/хэрэглэгч |
| **AUTHTXN_SOURCE** | `Nullable(String)` | Гүйлгээ үүссэн систем |
| **AUTHTXN_SOURCE_BIZMODE** | `Nullable(String)` | Эх системийн бизнес горим |
| **AUTHTXN_DEST** | `Nullable(String)` | Гүйлгээ очих систем |
| **AUTHTXN_DEST_BIZMODE** | `Nullable(String)` | Зорилтот системийн бизнес горим |
| **AUTHTXN_TYPE** | `Nullable(String)` | Гүйлгээний төрөл |
| **AUTHTXN_ISSACQ_CODE** | `Nullable(String)` | Issuer / Acquirer код |
| **AUTHTXN_INTERCHG_IND** | `Nullable(String)` | Interchange гүйлгээ эсэх |
| **AUTHTXN_INTERBRANCH_IND** | `Nullable(String)` | Салбар хоорондын гүйлгээ эсэх |
| **AUTHTXN_GEOGRAPHY_IND** | `Nullable(String)` | Дотоод / гадаад гүйлгээ |
| **AUTHTXN_BONUS** | `Nullable(Float32)` | Урамшууллын дүн |
| **AUTHTXN_FEE** | `Nullable(Float32)` | Шимтгэлийн дүн |
| **AUTHTXN_CHARGE_AT_IND** | `Nullable(String)` | Шимтгэл тооцох эсэх |
| **AUTHTXN_USG_UPDATE_IND** | `Nullable(String)` | Ашиглалтын мэдээлэл шинэчлэгдсэн эсэх |
| **AUTHTXN_ACQ_CHARGE_AT_IND** | `Nullable(String)` | Acquirer шимтгэл тооцох эсэх |
| **AUTHTXN_BILLING_CURRENCY_ID** | `Nullable(String)` | Тооцооны валют |
| **AUTHTXN_BILLING_TXN_AMT** | `Nullable(Float32)` | Тооцооны гүйлгээний дүн |
| **AUTHTXN_BILLING_CURRENCY_RATE** | `Nullable(String)` | Тооцооны ханш |
| **AUTHTXN_CURRENCY_DATE** | `Nullable(String)` | Валютын ханшийн огноо |
| **AUTHTXN_CRDACCT_NO** | `Nullable(String)` | Картын дансны дугаар |
| **AUTHTXN_CRDACCT_NO_TO** | `Nullable(String)` | Хүлээн авагчийн дансны дугаар |
| **AUTHTXN_POST_IND** | `Nullable(String)` | Бүртгэгдсэн эсэх (`Y`=тийм) |
| **AUTHTXN_COMPONENT_ID** | `Nullable(String)` | Системийн бүрэлдэхүүний ID |
| **AUTHTXN_ACQ_COMPONENT_ID** | `Nullable(String)` | Acquirer бүрэлдэхүүний ID |
| **AUTHTXN_ACQ_INST_ID** | `Nullable(String)` | Acquiring байгууллагын ID |
| **AUTHTXN_MTI** | `Nullable(String)` | ISO мессежийн төрлийн код |
| **AUTHTXN_PROC_CD** | `Nullable(String)` | Боловсруулалтын код |
| **AUTHTXN_CRDPLAN_ID** | `Nullable(String)` | Картын тариф төлөвлөгөөний ID |
| **AUTHTXN_CRDBRAND_ID** | `Nullable(String)` | Картын брэнд (Visa, Master) |
| **AUTHTXN_BATCH_REF_SERIAL** | `Nullable(Float32)` | Batch лавлагааны дугаар |
| **AUTHTXN_BONUS_POINT** | `Nullable(Float32)` | Урамшууллын оноо |
| **AUTHTXN_TERMBONUS_POINT** | `Nullable(Float32)` | Терминалын урамшууллын оноо |
| **AUTHTXN_LOYALTY_REMARKS** | `Nullable(String)` | Урамшууллын тайлбар |
| **AUTHTXN_FLOOR_LIMIT** | `Nullable(Float32)` | Offline зөвшөөрлийн дээд хязгаар |
| **AUTHTXN_PURCHASE_CODE** | `Nullable(String)` | Худалдан авалтын код |
| **AUTHTXN_REFERRAL_REF** | `Nullable(String)` | Referral лавлагаа |
| **AUTHTXN_FRAUD_CHECK** | `Nullable(String)` | Fraud шалгалтын үр дүн |
| **AUTHTXN_NOTIF_CHECK** | `Nullable(String)` | Notification шалгалт |
| **AUTHTXN_SUBSIDY_REBATE_QTY** | `Nullable(Float32)` | Татааст барааны тоо хэмжээ |
| **AUTHTXN_MCCGROUP_ID** | `Nullable(String)` | MCC бүлэг |
| **AUTHTXN_MERC_GROUP_ID** | `Nullable(String)` | Merchant бүлэг |
| **AUTHTXN_TXNTYPGRP_ID** | `Nullable(String)` | Гүйлгээний төрлийн бүлэг |
| **AUTHTXN_VTXNTYPGRP_ID** | `Nullable(String)` | Virtual гүйлгээний бүлэг |
| **AUTHTXN_TXN_ENTRY_MODE** | `Nullable(String)` | Гүйлгээ оруулах арга |
| **AUTHTXN_MERC_SLSREGION_ID** | `Nullable(String)` | Merchant борлуулалтын бүс |
| **AUTHTXN_MERC_SLSAREA_ID** | `Nullable(String)` | Merchant борлуулалтын талбай |
| **AUTHTXN_CNTRYGRP_ID** | `Nullable(String)` | Улсын бүлэг |
| **AUTHTXN_FWD_INST_ID** | `Nullable(String)` | Дамжуулах байгууллага |
| **AUTHTXN_STMT_INC_BONUS** | `Nullable(Float32)` | Хуулгад орсон бонус |
| **AUTHTXN_STMT_INC_FEE** | `Nullable(Float32)` | Хуулгад орсон шимтгэл |
| **AUTHTXN_STMT_INC_COST** | `Nullable(Float32)` | Хуулгад орсон зардал |
| **AUTHTXN_STMT_INC_COMM** | `Nullable(Float32)` | Хуулгад орсон комисс |
| **AUTHTXN_CARD_SEQ_NO** | `Nullable(String)` | Картын дарааллын дугаар |
| **AUTHTXN_FOREX_MARKUP_AMT** | `Nullable(Float32)` | Валютын нэмэгдэл шимтгэл |
| **AUTHTXN_AUTO_RELOAD_AMT** | `Nullable(Float32)` | Автомат цэнэглэлтийн дүн |
| **AUTHTXN_VS_TRXN_ID** | `Nullable(String)` | Visa гүйлгээний ID |
| **ACQUIRERID** | `Nullable(String)` | Acquiring банк |
| **ISSUERID** | `Nullable(String)` | Issuing банк |

<br>

### 📋 `CZ_CARD` (157 багана, 157 нь тайлбартай)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **CARD_NO** | `String` | Картын давтагдашгүй дугаар |
| **CARD_EMBOSSED_NAME** | `Nullable(String)` | Карт дээр хэвлэгдсэн нэр |
| **CARD_TYPE** | `Nullable(String)` | Картын төрөл (дебет, кредит) |
| **CARD_CRDACCT_NO** | `Nullable(String)` | Карт холбогдсон дансны дугаар |
| **CARD_CUST_ID** | `String` | Карт эзэмшигчийн харилцагчийн ID |
| **CARD_BS_IND** | `Nullable(String)` | Үндсэн эсвэл нэмэлт картын тэмдэглэгээ |
| **CARD_BASIC_CUST_ID** | `Nullable(String)` | Үндсэн карт эзэмшигчийн ID |
| **CARD_EXPIRY_CCYYMM** | `Nullable(String)` | Картын хүчинтэй хугацаа (YYYYMM) |
| **CARD_NEW_EXPIRY_CCYYMM** | `Nullable(String)` | Шинэ хүчинтэй хугацаа |
| **CARD_OLD_EXPIRY_CCYYMM** | `Nullable(String)` | Хуучин хүчинтэй хугацаа |
| **CARD_STATUS_RESPONSE** | `Nullable(String)` | Картын статусын хариу |
| **CARD_STATUS_ID** | `Nullable(String)` | Картын статусын ID |
| **CARD_PLASTIC_RESPONSE** | `Nullable(String)` | Карт хэвлэлтийн хариу |
| **CARD_PLASTIC_CODE** | `Nullable(String)` | Карт хэвлэлтийн код |
| **CARD_PLASTIC_DATE** | `Nullable(String)` | Карт хэвлэгдсэн огноо |
| **CARD_OLD_PLASTIC_RESPONSE** | `Nullable(String)` | Хуучин картын хэвлэлтийн хариу |
| **CARD_OLD_PLASTIC_CODE** | `Nullable(String)` | Хуучин картын хэвлэлтийн код |
| **CARD_OLD_PLASTIC_DATE** | `Nullable(String)` | Хуучин картын хэвлэгдсэн огноо |
| **CARD_NEW_PLASTIC_RESPONSE** | `Nullable(String)` | Шинэ картын хэвлэлтийн хариу |
| **CARD_NEW_PLASTIC_CODE** | `Nullable(String)` | Шинэ картын хэвлэлтийн код |
| **CARD_NEW_PLASTIC_DATE** | `Nullable(String)` | Шинэ картын хэвлэгдсэн огноо |
| **CARD_FIRST_USE_IND** | `Nullable(String)` | Анх ашиглагдсан эсэх (`Y`=тийм) |
| **CARD_FIRST_USE_DATE** | `Nullable(String)` | Анх ашигласан огноо |
| **CARD_FIRST_USE_TIME** | `Nullable(String)` | Анх ашигласан цаг |
| **CARD_RTNCHQ_CNT** | `Nullable(Float32)` | Буцаагдсан чекийн тоо |
| **CARD_CLASS** | `Nullable(String)` | Картын ангилал |
| **CARD_CARDPLAN_ID** | `Nullable(String)` | Картын тариф төлөвлөгөөний ID |
| **CARD_PITMRST_TMPL_ID** | `Nullable(String)` | PIN дахин хэвлэх загварын ID |
| **CARD_SWIPE_MODE** | `Nullable(String)` | Swipe горим |
| **CARD_CREDIT_CHK_LVL_IND** | `Nullable(String)` | Зээлийн шалгалтын түвшин |
| **CARD_CREDIT_CHECK_IND** | `Nullable(String)` | Зээлийн шалгалт хийх эсэх |
| **CARD_COLLRISK_CHECK_IND** | `Nullable(String)` | Барьцааны эрсдэлийн шалгалт |
| **CARD_VELOCITY_CHECK_IND** | `Nullable(String)` | Velocity (давтамж) шалгалт |
| **CARD_REMARKS** | `Nullable(String)` | Картын нэмэлт тайлбар |
| **CARD_RTNCHQ_LMT** | `Nullable(Float32)` | Буцаагдсан чекийн дээд хязгаар |
| **CARD_BILLING_CYCLE** | `Nullable(String)` | Тооцооны мөчлөг |
| **REF_SERIAL** | `Nullable(String)` | Лавлагааны дугаар |
| **CARD_BRANCH_ISSUER_CODE** | `Nullable(String)` | Картыг олгосон салбарын код |
| **CARD_BRANCH_ID** | `Nullable(String)` | Салбарын ID |
| **CARD_RISKPFL_ID** | `Nullable(String)` | Эрсдэлийн профайл ID |
| **CARD_VELORISKPFL_ID** | `Nullable(String)` | Velocity эрсдэлийн профайл ID |
| **CARD_DESPATCH_BRANCH** | `Nullable(String)` | Илгээсэн салбар |
| **CARD_DELIVERY_METHOD** | `Nullable(String)` | Хүргэлтийн арга |
| **CARD_DELIVERY_ADDR_CD** | `Nullable(String)` | Хүргэлтийн хаягийн код |
| **CARD_REGISTRATION_CODE** | `Nullable(String)` | Бүртгэлийн код |
| **CARD_REGISTRATION_DATE** | `Nullable(String)` | Бүртгэгдсэн огноо |
| **CARD_BASIC_CARD_NO** | `Nullable(String)` | Үндсэн картын дугаар |
| **CARD_PLASTIC_FACE_DESIGN** | `Nullable(String)` | Картын дизайн |
| **CARD_LAST_AUTH_CITY_ID** | `Nullable(String)` | Сүүлийн гүйлгээний хот |
| **CARD_LAST_AUTH_COUNTRY_ID** | `Nullable(String)` | Сүүлийн гүйлгээний улс |
| **CARD_LAST_AUTH_TIMESTAMP** | `Nullable(DateTime)` | Сүүлийн гүйлгээний огноо, цаг |
| **CARD_INTRODUCE_CARD_NO** | `Nullable(String)` | Холбогдох картын дугаар |
| **CARD_APP_NO** | `Nullable(String)` | Өргөдлийн дугаар |
| **CARD_LAST_REVIEW_DATE** | `Nullable(String)` | Сүүлд хянасан огноо |
| **CARD_TOBE_REVIEW_IND** | `Nullable(String)` | Хянах шаардлагатай эсэх |
| **CARD_TOBE_RENEW_IND** | `Nullable(String)` | Сунгах шаардлагатай эсэх |
| **CARD_LIMIT_INCREASE_RATE** | `Nullable(Float32)` | Лимит нэмэгдүүлэх хувь |
| **CARD_CONTACT_TYPE_ID** | `Nullable(String)` | Холбоо барих төрлийн ID |
| **CARD_ACCTFEE_WAIVE_CNT** | `Nullable(Float32)` | Төлбөр чөлөөлсөн тоо |
| **CARD_PARTNER_ID** | `Nullable(String)` | Партнер байгууллагын ID |
| **CARD_SALE_REF** | `Nullable(String)` | Борлуулалтын лавлагаа |
| **CARD_ACCTFEERUN_MONTH** | `Nullable(String)` | Төлбөр тооцсон сар |
| **CARD_EVENTFEEGRP_ID** | `Nullable(String)` | Төлбөрийн бүлгийн ID |
| **CARD_LYLPFLGRP_ID** | `Nullable(String)` | Урамшууллын профайл ID |
| **CARD_EMBOSS_SEQ_NO** | `Nullable(Float32)` | Хэвлэлийн дарааллын дугаар |
| **CARD_NEWRPL_IND** | `Nullable(String)` | Шинээр солих эсэх |
| **CARD_EC_CURR_ID** | `Nullable(String)` | E-money валют |
| **CARD_EC_BAL_LMT** | `Nullable(Float32)` | E-money үлдэгдлийн лимит |
| **CARD_EC_SINGLE_TXN_LMT** | `Nullable(Float32)` | Нэг гүйлгээний лимит |
| **CARD_EC_THRESHOLD** | `Nullable(Float32)` | E-money босго |
| **CARD_EC_AUTO_RELOAD_IND** | `Nullable(String)` | Автомат цэнэглэлт |
| **CARD_ANNIVERSARY_DATE** | `Nullable(String)` | Картын ойн огноо |
| **CARD_APP_DATE** | `Nullable(String)` | Өргөдөл өгсөн огноо |
| **CARD_DELIVERY_STATUS** | `Nullable(String)` | Хүргэлтийн төлөв |
| **CARD_FAIL_DELV_REASON** | `Nullable(String)` | Хүргэлт амжилтгүй болсон шалтгаан |
| **CARD_LAST_RENEW_DATE** | `Nullable(String)` | Сүүлд сунгасан огноо |
| **CARD_PIN_OPTOUT_IND** | `Nullable(String)` | PIN ашиглахгүй эсэх |
| **CARD_SLSMAN_ID** | `Nullable(String)` | Борлуулалтын ажилтан |
| **CARD_EXCEED_LMT_PCT** | `Nullable(Float32)` | Лимитээс хэтрэх хувь |
| **CARD_EMBOSSED_DATE** | `Nullable(String)` | Карт хэвлэгдсэн огноо |
| **CARD_LAST_OVERSEA_DATE** | `Nullable(String)` | Сүүлийн гадаад гүйлгээ |
| **CARD_OVERSEA_USG_IND** | `Nullable(String)` | Гадаад ашиглалт |
| **CARD_ACTIVATE_DATE** | `Nullable(String)` | Карт идэвхжүүлсэн огноо |
| **CARD_ISSUED_BY** | `Nullable(String)` | Картыг олгосон хэрэглэгч |
| **CARD_ATM_CHK_IND** | `Nullable(String)` | ATM ашиглах зөвшөөрөл |
| **CARD_POS_CHK_IND** | `Nullable(String)` | POS ашиглах зөвшөөрөл |
| **CARD_ECOMM_CHK_IND** | `Nullable(String)` | Онлайн гүйлгээ зөвшөөрөх эсэх |
| **CARD_TO_BE_BLOCK** | `Nullable(String)` | Блоклох шаардлагатай эсэх |
| **VERSION** | `Nullable(Float32)` | Бичлэгийн хувилбар |
| **CARD_FIRST_ACTIVATE_DATE** | `Nullable(String)` | Анх идэвхжүүлсэн огноо |
| **CARD_AUTH_METHOD** | `Nullable(String)` | Баталгаажуулах арга |
| **CARD_MANAGER** | `Nullable(String)` | Картын хариуцсан менежер |
| **CARD_CURRENCY** | `Nullable(String)` | Картын валют |
| **CRDPLAN_PRODUCT_NAME** | `Nullable(String)` | Картын бүтээгдэхүүний нэр |
| **CURRENCY_CODE** | `Nullable(String)` | Валютын код |
| **CURRENCY_NAME** | `Nullable(String)` | Валютын нэр |
| **BRANCH_DESC** | `Nullable(String)` | Салбарын нэр |
| **B_TXNDATE** | `Date` | Бичлэгийн огноо (partition key) |
| **CARD_EVENTFEEGRP_IND** | `Nullable(String)` | Үйл явдлын хэмжилтийн бүлгийн үзүүлэлт |
| **CARD_LYLPFLGRP_IND** | `Nullable(String)` | Үнэнч байдлын оноон бүлгийн тэмдэглэгч |
| **CARD_CONTACT_TYPE_ID_OF** | `Nullable(String)` | Офисын харилцааны төрлийн дугаар |
| **CARD_DELIVERY_ADDR_CD_OF** | `Nullable(String)` | Офисын хүргэлтийн хаягийн код |
| **CARD_ENCODED_NAME** | `Nullable(String)` | Карт дээр кодлогдон хэвлэгдсэн нэр |
| **CARD_FAIL_TO_DELV_DATE** | `Nullable(String)` | Картыг хүргэж чадаагүй огноо |
| **CARD_LAST_ASF_DATE** | `Nullable(String)` | Сүүлийн жилийн үйлчилгээний хэмжилт (ASF) авсан огноо |
| **CARD_LAST_TAX_DATE** | `Nullable(String)` | Сүүлийн татвар авсан огноо |
| **CARD_PARTNER_MBRSHIP_NUM** | `Nullable(String)` | Хамтрагч байгуулагын гишүүнчлэлийн дугаар |
| **CARD_SUPPCRD_ACC_IND** | `Nullable(String)` | Нэмэлт карт гэдгийг заах үзүүлэлт |
| **CARD_ADD_EMBOSSED_LINE** | `Nullable(String)` | Карт дээр нэмж хэвлэх мөрийн текст |
| **CARD_ALERT_OPTOUT_IND** | `Nullable(String)` | Мэдэгдэл хүлээн авахаас татгалзсан үзүүлэлт |
| **CARD_LAST_OVERSEA_COUNTRY_ID** | `Nullable(String)` | Картыг гадаадад хамгийн сүүлд ашигласан улсын дугаар |
| **CARD_EMBOSS_IND** | `Nullable(String)` | Карт дарангуйлалтай (embossed) эсэх үзүүлэлт |
| **CARD_CASH_CHECK_IND** | `Nullable(String)` | Бэлэн мөнгөний гүйлгээ шалгах үзүүлэлт |
| **CARD_OVERSEAS_TXN_START_DATE** | `Nullable(String)` | Гадаадын гүйлгээ идэвхтэй болох огноо |
| **CARD_OVERSEAS_TXN_END_DATE** | `Nullable(String)` | Гадаадын гүйлгээ идэвхгүй болох огноо |
| **CARD_GIFTCAT_ID** | `Nullable(String)` | Бэлгийн картын ангиллын дугаар |
| **CARD_GIFT_ID** | `Nullable(String)` | Бэлгийн картын дугаар |
| **CARD_PMPC_SERIAL_NO** | `Nullable(String)` | PMPC картын дэс дугаар |
| **CARD_OVERSEA_USG_START_DATE** | `Nullable(String)` | Гадаадад ашиглах эрх эхлэх огноо |
| **CARD_OVERSEA_USG_END_DATE** | `Nullable(String)` | Гадаадад ашиглах эрх дуусах огноо |
| **CARD_OVERSEA_USG_CHANGE_BY_ID** | `Nullable(String)` | Гадаадад ашиглах эрхийг өөрчилсөн хэрэглэгчийн дугаар |
| **CARD_PLASTIC_UPDATED_BY** | `Nullable(String)` | Картын физик (plastic) мэдээлэл шинэчилсэн хэрэглэгч |
| **CARD_TRACK1_UPDATE_IND** | `Nullable(String)` | Соронз зурвасын Track1 шинэчлэлтийн үзүүлэлт |
| **CARD_LAST_ASF_REFUND_DATE** | `Nullable(String)` | ASF буцаалт хийсэн сүүлийн огноо |
| **CARD_LAST_ASF_REFUND_IND** | `Nullable(String)` | ASF буцаалт хийсэн эсэх үзүүлэлт |
| **CARD_ACCTFEE_ID** | `Nullable(String)` | Дансны жилийн хэмжилтийн дугаар |
| **CARD_DORMANTRUN_MONTH** | `Nullable(String)` | Идэвхгүй байдлын горим ажилласан сар |
| **CARD_PINPAD_ACTIVATE** | `Nullable(String)` | PIN дэвтэрцэр идэвхжүүлэлт |
| **CARD_PIN_DELIVERY_METHOD** | `Nullable(String)` | PIN хүргэлтийн арга |
| **CARD_INTL_CHK_IND** | `Nullable(String)` | Олон улсын гүйлгээ шалгах үзүүлэлт |
| **CARD_ACTIVATED_BY** | `Nullable(String)` | Картыг идэвхжүүлсэн хэрэглэгч |
| **CARD_CRD_ID** | `Nullable(String)` | Картын бүртгэлийн дугаар (CRD ID) |
| **CARD_EVENTPFL_ID** | `Nullable(String)` | Үйл явдлын профайлын дугаар |
| **CARD_MGSTRP_CHK_IND** | `Nullable(String)` | Соронз зурвасын шалгалтын үзүүлэлт |
| **CARD_MOTO_CHECK_IND** | `Nullable(String)` | Захидал/утас (MOTO) гүйлгээний шалгалтын үзүүлэлт |
| **CARD_ATC** | `Nullable(String)` | Програм хэрэглэлтийн гүйлгээний тоолуур (ATC) |
| **CARD_OLD_ATC** | `Nullable(String)` | Өмнөх ATC утга |
| **CARD_AUTO_PAYPLAN_THRESHLD** | `Nullable(Float32)` | Авто төлбөрийн хөтөлбөрийн босго дүн |
| **CARD_RECURR_CHK_IND** | `Nullable(String)` | Давтан гүйлгээ шалгах үзүүлэлт |
| **CARD_REPLACE_IND** | `Nullable(String)` | Карт солигдсон эсэх үзүүлэлт |
| **CARD_ABDRUN_MONTH** | `Nullable(String)` | ABD дебит горим ажилласан сар |
| **CARD_NEW_BILLING_CYCLE** | `Nullable(String)` | Шинэ тооцооны мөчлөгийн тоо |
| **CARD_STMTRUN_MONTH** | `Nullable(String)` | Хуулга боловсруулсан сар |
| **CARD_GENSTMT_MONTH** | `Nullable(String)` | Хуулга үүсгэсэн сар |
| **CARD_PTS_STMTRUN_MONTH** | `Nullable(String)` | Онооны хуулга боловсруулсан сар |
| **CARD_ADRUN_MONTH** | `Nullable(String)` | AD горим ажилласан сар |
| **CARD_AAV_IND** | `Nullable(String)` | Автомат хаяг баталгаажуулалт (AAV) үзүүлэлт |
| **CARD_FALLBACK_CHK_IND** | `Nullable(String)` | Нөөц горимын гүйлгээ шалгах үзүүлэлт |
| **CZ_TAX_FIELD** | `Nullable(String)` | НӨАТ тооцоолох талбар |
| **CRDCHGTYPE_NAME** | `Nullable(String)` | Картын төлбөрийн төрлийн нэр |
| **CRDCLASS_NAME** | `Nullable(String)` | Картын ангиллын нэр |
| **CRDPLAN_BIN_ID** | `Nullable(String)` | Картын төлөвлөгөөний BIN дугаар |
| **CRDPLAN_CARD_BRAND** | `Nullable(String)` | Картын брэнд (Visa, Mastercard гэх мэт) |
| **CRDPLAN_CARD_MAKE** | `Nullable(String)` | Картын үйлдвэрлэлийн төрөл (физик/виртуал) |
| **CRDPLAN_CURRENCY_ID** | `Nullable(String)` | Картын төлөвлөгөөний валютын дугаар |
| **BRANCH_CITY_ID** | `Nullable(String)` | Салбар байрших хотын дугаар |
| **BRANCH_COUNTRY_ID** | `Nullable(String)` | Салбар байрших улсын дугаар |


<br>

### 📋 `CZ_CARDBAL_CREDIT` (51 багана)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **CENTRE_CODE** | `Nullable(String)` | Төвийн код |
| **SOL_ID** | `Nullable(String)` | Салбарын код |
| **CARDNO** | `String` | Картын давтагдашгүй дугаар |
| **BASIC_SUPP** | `Nullable(String)` | Үндсэн эсвэл нэмэлт картын тэмдэглэгээ |
| **BASIC_CARDNO** | `Nullable(String)` | Үндсэн картын дугаар |
| **FIN_ACCNT** | `Nullable(String)` | Санхүүгийн дансны дугаар |
| **CP_ACCNT** | `Nullable(String)` | CP дансны дугаар |
| **EMBOSSNAME** | `Nullable(String)` | Карт дээр хэвлэгдсэн нэр |
| **CRM_NAME** | `Nullable(String)` | Харилцагчийн бүтэн нэр |
| **CIF_ID** | `Nullable(String)` | Харилцагчийн CIF дугаар |
| **CRM_COMPANY_NAME** | `Nullable(String)` | Байгууллагын нэр |
| **PROD_GROUP** | `Nullable(String)` | Бүтээгдэхүүний бүлэг |
| **PROD_CODE** | `Nullable(String)` | Бүтээгдэхүүний код |
| **CARD_BRAND** | `Nullable(String)` | Картын брэнд (Visa, MasterCard гэх мэт) |
| **CARD_TYPE** | `Nullable(String)` | Картын төрөл |
| **PRODUCT_TYPE** | `Nullable(String)` | Бүтээгдэхүүний төрөл |
| **LINELIMIT** | `Nullable(Float32)` | Картын зээлийн лимит (валютаар) |
| **CURR_CODE** | `Nullable(String)` | Валютын код |
| **BALANCE_TOTAL** | `Nullable(Float32)` | Нийт үлдэгдэл |
| **BALANCE** | `Nullable(Float32)` | Одоогийн үлдэгдэл |
| **AGE_CODE** | `Nullable(Float32)` | Хугацаа хэтрэлтийн ангиллын код |
| **ANNIV_DATE** | `Nullable(String)` | Картын ойн огноо |
| **EXPIRY_DATE** | `Nullable(String)` | Картын хугацаа дуусах огноо |
| **STATUS_CODE** | `Nullable(String)` | Картын статусын код |
| **MANAGER** | `Nullable(String)` | Хариуцсан менежерийн ID |
| **B_RATE** | `Nullable(Float32)` | Ханш |
| **B_TXNDATE** | `DateTime` | Бичлэгийн огноо, цаг |
| **B_TXNDAY** | `Nullable(Float32)` | Гүйлгээний хоногийн тоо |
| **FLPC** | `Nullable(Float32)` | Лимит ашиглалтын хувь |
| **CUSTOMER_BAL** | `Nullable(Float32)` | Харилцагчийн нийт үлдэгдэл |
| **FELMT** | `Nullable(Float32)` | Лимиттэй холбоотой төлбөр |
| **FCADV** | `Nullable(Float32)` | Бэлэн мөнгөний урьдчилгаа |
| **FINTRV** | `Nullable(Float32)` | Хуримтлагдсан хүү |
| **FANNL** | `Nullable(Float32)` | Жилийн шимтгэл |
| **FREPL** | `Nullable(Float32)` | Карт солих шимтгэл |
| **YESTERDAY_BALANCE** | `Nullable(Float32)` | Өчигдрийн үлдэгдэл |
| **YESTERDAY_BALANCE_MNT** | `Nullable(Float32)` | Өчигдрийн үлдэгдэл (төгрөгөөр) |
| **B_YESTERDAY_DATE** | `Nullable(DateTime)` | Өчигдрийн огноо |
| **B_TOMORROW_DATE** | `Nullable(DateTime)` | Маргаашийн огноо |
| **LINELIMIT_MNT** | `Nullable(Float32)` | Зээлийн лимит (төгрөгөөр) |
| **OUTSTANDING_IPP** | `Nullable(Float32)` | IPP үлдэгдэл |
| **ACRU_EXCESS** | `Nullable(Float32)` | Хэтэрсэн хуримтлагдсан хүү |
| **MTD_ACC_TOTAL** | `Nullable(Float32)` | Сарын хуримтлагдсан нийт дүн |
| **ACCU_MIN_PAY_AMT** | `Nullable(Float32)` | Хамгийн бага төлөх дүн |
| **CARD_PLASTIC_CODE** | `Nullable(String)` | Картын пластик код |
| **B_TXNMONTH** | `Nullable(Float32)` | Гүйлгээний сар |
| **CARD_PLASTIC_DATE** | `Nullable(String)` | Пластик хэвлэгдсэн огноо |
| **CARD_ACTIVATE_DATE** | `Nullable(String)` | Карт идэвхжүүлсэн огноо |
| **B_RATE_NEXTDAY** | `Nullable(Float32)` | Дараагийн өдрийн ханш |
| **TOX** | `Nullable(String)` | TOX үзүүлэлт |
| **LINELIMIT_CRDLMT** | `Nullable(Float32)` | Картын зээлийн лимит (credit limit) |


<br>


### 📋 `CZ_MERCHANT` (65 багана)

| Баганын нэр | Төрөл | Тайлбар |
|---|---|---|
| **MOD_DATE** | `Nullable(DateTime64(6))` | Сүүлд өөрчлөгдсөн огноо, цаг |
| **MERCHANT_ID** | `String` | Худалдааны газрын давтагдашгүй ID |
| **MERCHANT_AMEX_ID** | `Nullable(String)` | AMEX системийн ID |
| **MERCHANT_DBA_NAME** | `Nullable(String)` | Хэрэглэгчид харагдах нэр (DBA) |
| **MERCHANT_TRADE_NAME** | `Nullable(String)` | Арилжааны нэр |
| **MERCHANT_PYMT_ACC_NAME** | `Nullable(String)` | Тооцооны дансны нэр |
| **MERCHANT_REG_NO** | `Nullable(String)` | Байгууллагын бүртгэлийн дугаар |
| **MERCHANT_PYMT_ACC_NO** | `Nullable(String)` | Тооцооны дансны дугаар |
| **MERCHANT_STATUS_DATE** | `Nullable(String)` | Статус өөрчлөгдсөн огноо |
| **MERCHANT_CAPTURED_DATE** | `Nullable(String)` | Бүртгэгдсэн огноо |
| **MERCHANT_APPROVED_DATE** | `Nullable(String)` | Зөвшөөрөгдсөн огноо |
| **MERCHANT_PYMT_DESC** | `Nullable(String)` | Тооцооны тайлбар |
| **MERCHANT_MCC_ID** | `Nullable(String)` | Худалдааны ангиллын код (MCC) |
| **MERCHANT_SECRET_PHRASE** | `Nullable(String)` | Нууц үг / түлхүүр үг |
| **MERCHANT_MCOSTGRP_DATE** | `Nullable(String)` | Зардлын бүлэг шинэчлэгдсэн огноо |
| **MERCHANT_GENSTMT_DATE** | `Nullable(String)` | Хуулга үүсгэсэн огноо |
| **MERCHANT_REFUND_PYMT_DESC** | `Nullable(String)` | Буцаалтын тайлбар |
| **MERCHANT_MCOSTGRP_ID** | `Nullable(String)` | Зардлын бүлгийн ID |
| **MERCHANT_REFUND_PYMT_ACC_NAME** | `Nullable(String)` | Буцаалтын дансны нэр |
| **MERCHANT_CIF_NO** | `Nullable(String)` | Харилцагчийн CIF |
| **MERCHANT_SIC** | `Nullable(String)` | SIC код |
| **MOD_USER** | `Nullable(String)` | Өөрчилсөн хэрэглэгч |
| **MERCHANT_CAPTURED_BY** | `Nullable(String)` | Бүртгэсэн хэрэглэгч |
| **MERCHANT_FEE_ACC_NO** | `Nullable(String)` | Шимтгэлийн данс |
| **MERCHANT_PYMT_CURRENCY_ID** | `Nullable(String)` | Тооцооны валют |
| **MERCHANT_BRANCH_ID** | `Nullable(String)` | Салбарын ID |
| **MERCHANT_APPROVED_BY** | `Nullable(String)` | Зөвшөөрсөн хэрэглэгч |
| **MERCHANT_ACQRISKPFL_ID** | `Nullable(String)` | Acquirer эрсдэлийн профайл |
| **MERCHANT_SALES_REGION_ID** | `Nullable(String)` | Борлуулалтын бүс |
| **MERCHANT_FEE_PFL_ID** | `Nullable(String)` | Шимтгэлийн профайл |
| **MERCHANT_STATUS_ID** | `Nullable(String)` | Статусын ID |
| **MERSTATUS_NAME** | `Nullable(String)` | Статусын нэр |
| **MERCHANT_REMARKS** | `Nullable(String)` | Нэмэлт тайлбар |
| **MERCHANT_QR_HOST_URL** | `Nullable(String)` | QR төлбөрийн URL |
| **MERCHANT_HOLD_PYMT_THRESHOLD** | `Nullable(Float64)` | Төлбөр барих босго |
| **MERCHANT_ECOMM_REF** | `Nullable(String)` | E-commerce лавлагаа |
| **MERCHANT_GENSTMT_MONTH** | `Nullable(String)` | Хуулга үүсгэх сар |
| **MERCHANT_REFUND_PYMT_ACC_NO** | `Nullable(String)` | Буцаалтын данс |
| **MERCHANT_STMT_TYPE** | `Nullable(String)` | Хуулгын төрөл |
| **MERCHANT_HOLD_PYMT_DAYS** | `Nullable(Float64)` | Төлбөр барих хоног |
| **MERCHANT_PARENT_ID** | `Nullable(String)` | Эх байгууллагын ID |
| **MERCHANT_TYPE** | `Nullable(String)` | Худалдааны газрын төрөл |
| **MERCHANT_PYMT_METHOD** | `Nullable(String)` | Төлбөрийн арга |
| **MERCHANT_TAX_REF_NO** | `Nullable(String)` | Татварын дугаар |
| **MERCHANT_CATEGORY** | `Nullable(String)` | Ангилал |
| **MERCHANT_COUNT_TERM** | `Nullable(Float64)` | Терминалын тоо |
| **MERCHANT_HOLD_PYMT_IND** | `Nullable(String)` | Төлбөр барих эсэх |
| **CONTACT_MOBILE** | `Nullable(String)` | Холбоо барих утас |
| **ADDRESS_LINE1** | `Nullable(String)` | Хаяг |
| **CONTRACT_NUMBER** | `Nullable(String)` | Гэрээний дугаар |
| **GATEWAY_TYPE** | `Nullable(String)` | Gateway төрөл |
| **MCC_GROUP** | `Nullable(String)` | MCC бүлэг |
| **RISK_LEVEL** | `Nullable(String)` | Эрсдэлийн түвшин |
| **MERCHANT_MAPSTGPFL_ID** | `Nullable(String)` | Худалдаачийн харилцааны профайлын оноолтын дугаар |
| **MERCHANT_MERORG_ID** | `Nullable(String)` | Худалдаачийн байгуулагын дугаар |
| **MERCHANT_PAY_TO_PARENT_ID** | `Nullable(String)` | Эх байгуулагад төлөх тохиргооны дугаар |
| **MERCHANT_BASE_ADRTYPE_ID** | `Nullable(String)` | Үндсэн хаягийн төрлийн дугаар |
| **MERCHANT_STMT_ADDR_ID** | `Nullable(String)` | Хуулгын хаягийн дугаар |
| **MERCHANT_DUAL_PYMT_IND** | `Nullable(String)` | Давхар төлбөр боловсруулах үзүүлэлт |
| **SERVICE_CENTER** | `Nullable(String)` | Үйлчилгээний төвийн нэр |
| **CASH_SYSTEM** | `Nullable(String)` | Бэлэн мөнгөний системийн нэр |
| **GROSS_SETTLEMENT** | `Nullable(String)` | Нийт (gross) тооцоо хийх эсэх |
| **QPAY_ACCOUNT** | `Nullable(String)` | QPay системийн дансны мэдээлэл |
| **TOGTMOL_SHIMTGEL** | `Nullable(String)` | Тогтмол шимтгэл (сар бүрийн суутгал) |
| **RM_DOMAIN** | `Nullable(String)` | Харилцааны менежерийн домэйн |

<br>