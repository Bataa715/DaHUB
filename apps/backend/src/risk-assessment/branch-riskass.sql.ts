/* eslint-disable */
/**
 * Inline SQL replacement for RISKASSESSMENT.BranchRiskass stored procedure.
 *
 * Хэрэглэгчийн Oracle account дээр procedure-ийг EXECUTE хийх эрх байхгүй
 * тул procedure-ийн биеийг яг тэр чигээр нь SELECT хэлбэртэй болгож,
 * шууд гүйцэтгэхээр тоноглов.
 *
 * Bind variables (named):
 *   :p_SOLIDINPUT             — салбарын SOLID
 *   :p_DATE                   — тайлангийн төгсгөл огноо
 *   :p_DATEBEG                — тайлангийн эхлэх огноо
 *   :v_lastAuditDate          — өмнө нь TS-д бодсон утга
 *   :v_avgFollowupAddTotal    — өмнө нь TS-д бодсон утга
 *   :v_avgPercent             — өмнө нь TS-д бодсон утга
 *   :v_avgFollowupResultTotal — өмнө нь TS-д бодсон утга
 */

// ── Helper queries (PROCEDURE-ийн эхэн дэх 3 SELECT INTO-ийн орлуулалт) ──
export const SQL_LAST_AUDIT_DATE = `
  SELECT MAX(ar.AUDITENDDATE) AS V
    FROM RISKASSESSMENT.BRANCHMAIN bm
         JOIN RISKASSESSMENT.AUDITRESULT ar
             ON     bm.BRANCHID = ar.BRANCHID
                AND REGEXP_LIKE(ar.BRANCHID, '^[0-9]+$')
   WHERE     bm.SOLID = :p_SOLIDINPUT
         AND (ar.TYPE != 'followup' OR ar.TYPE IS NULL)
`;

export const SQL_AVG_FOLLOWUP_ADD = `
  SELECT AVG(fa.TOTAL) AS V
    FROM RISKASSESSMENT.BRANCHMAIN t1
         JOIN RISKASSESSMENT.FOLLOWUPADD fa
             ON     t1.BRANCHID = fa.BRANCHID
                AND REGEXP_LIKE(fa.BRANCHID, '^[0-9]+$')
   WHERE t1.SOLID = :p_SOLIDINPUT AND fa.TDATE > :v_lastAuditDate
`;

export const SQL_AVG_FOLLOWUP_RESULT = `
  SELECT AVG(fr.PERCENT) AS PCT, AVG(fr.TOTAL) AS TOT
    FROM RISKASSESSMENT.BRANCHMAIN t1
         JOIN RISKASSESSMENT.FOLLOWUPRESULT fr
             ON     t1.BRANCHID = fr.BRANCHID
                AND REGEXP_LIKE(fr.BRANCHID, '^[0-9]+$')
   WHERE t1.SOLID = :p_SOLIDINPUT AND fr.TDATE > :v_lastAuditDate
`;

// ── Procedure-ийн бие нь UNION ALL хэлбэрээр ─────────────────────────────
export const SQL_BRANCH_RISKASS = `
        -- 1: Зээлийн төлөвлөгөөний биелэлт
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               CASE WHEN NVL(SUM(FN.PLAN), 0) = 0 THEN '100'
                    ELSE TO_CHAR(ROUND(
                           (SUM(FN.RFORMANCE)
                            + NVL((SELECT SUM(CD.BALANCE_MNT)/1000
                                     FROM RISKASSESSMENT.BRANCHMAIN BM2
                                          JOIN RISKASSESSMENT.CDC2010 CD ON BM2.SOLID = CD.SOL_ID
                                    WHERE BM2.TDATE = :p_DATE
                                      AND CD.B_TXNDATE = :p_DATE
                                      AND BM2.SOLID = :p_SOLIDINPUT), 0))
                           / SUM(FN.PLAN) * 100, 2))
               END AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               CASE WHEN NVL(SUM(FN.PLAN), 0) = 0 THEN '100%'
                    ELSE TO_CHAR(ROUND(
                           (SUM(FN.RFORMANCE)
                            + NVL((SELECT SUM(CD.BALANCE_MNT)/1000
                                     FROM RISKASSESSMENT.BRANCHMAIN BM2
                                          JOIN RISKASSESSMENT.CDC2010 CD ON BM2.SOLID = CD.SOL_ID
                                    WHERE BM2.TDATE = :p_DATE
                                      AND CD.B_TXNDATE = :p_DATE
                                      AND BM2.SOLID = :p_SOLIDINPUT), 0))
                           / SUM(FN.PLAN) * 100, 2)) || '%'
               END AS DESCRIPTION_TEXT,
               :p_DATEBEG AS BEGINDATE, :p_DATE AS ENDDATE,
               'Зээлийн төлөвлөгөөний биелэлт' AS ID, '1' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM JOIN RISKASSESSMENT.FNB1041 FN ON BM.SOLID = FN.SOL_ID
         WHERE BM.TDATE = :p_DATE AND FN.TXNDATE = :p_DATE
           AND BM.SOLID = :p_SOLIDINPUT AND FN.RORDER = 6
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 2: Эх үүсвэрийн төлөвлөгөөний биелэлт
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               CASE WHEN NVL(SUM(FN.PLAN), 0) = 0 THEN '100'
                    ELSE TO_CHAR(ROUND(SUM(FN.RFORMANCE) / SUM(FN.PLAN) * 100, 2))
               END AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               CASE WHEN NVL(SUM(FN.PLAN), 0) = 0 THEN '100%'
                    ELSE TO_CHAR(ROUND(SUM(FN.RFORMANCE) / SUM(FN.PLAN) * 100, 2)) || '%'
               END AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Эх үүсвэрийн төлөвлөгөөний биелэлт' AS ID, '2' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM JOIN RISKASSESSMENT.FNB1041 FN ON BM.SOLID = FN.SOL_ID
         WHERE BM.TDATE = :p_DATE AND FN.TXNDATE = :p_DATE
           AND BM.SOLID = :p_SOLIDINPUT AND FN.RORDER = 58
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 3: Дотоод үнэлгээний ашиг (PKEY = 20297)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               CASE WHEN NVL(SUM(FNI.PLAN), 0) = 0 THEN '100'
                    ELSE TO_CHAR(ROUND(SUM(FNI.RFORMANCE) / SUM(FNI.PLAN) * 100, 2))
               END AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               CASE WHEN NVL(SUM(FNI.PLAN), 0) = 0 THEN '100%'
                    ELSE TO_CHAR(ROUND(SUM(FNI.RFORMANCE) / SUM(FNI.PLAN) * 100, 2)) || '%'
               END AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Дотоод үнэлгээний ашиг' AS ID, '3' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM JOIN RISKASSESSMENT.FNI1041 FNI ON BM.SOLID = FNI.SOLID
         WHERE BM.TDATE = :p_DATE AND FNI.TDATE = :p_DATE
           AND BM.SOLID = :p_SOLIDINPUT AND FNI.PKEY = 20297
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 4: Хүүгийн бус орлого (RORDER = 99)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               CASE WHEN NVL(SUM(FNI.PLAN), 0) = 0 THEN '100'
                    ELSE TO_CHAR(ROUND(SUM(FNI.RFORMANCE) / SUM(FNI.PLAN) * 100, 2))
               END AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               CASE WHEN NVL(SUM(FNI.PLAN), 0) = 0 THEN '100%'
                    ELSE TO_CHAR(ROUND(SUM(FNI.RFORMANCE) / SUM(FNI.PLAN) * 100, 2)) || '%'
               END AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Хүүгийн бус орлого' AS ID, '4' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM JOIN RISKASSESSMENT.FNI1041 FNI ON BM.SOLID = FNI.SOLID
         WHERE BM.TDATE = :p_DATE AND FNI.TDATE = :p_DATE
           AND BM.SOLID = :p_SOLIDINPUT AND FNI.RORDER = 99
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 5: Анхаарал хандуулах зээл (grade 2, CDC 2/3)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               CASE WHEN denom.total_bal = 0 THEN '0'
                    ELSE TO_CHAR(ROUND(SUM(SUB.BALANCEMNT) / denom.total_bal * 100, 2))
               END AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               CASE WHEN denom.total_bal = 0 THEN '0%'
                    ELSE TO_CHAR(ROUND(SUM(SUB.BALANCEMNT) / denom.total_bal * 100, 2)) || '%'
               END AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Анхаарал хандуулах зээл' AS ID, '5' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM (SELECT TO_CHAR(L.SOLID) AS SOLID, L.BALANCEMNT
                  FROM RISKASSESSMENT.LNL2010 L
                 WHERE L.SOLID = :p_SOLIDINPUT
                   AND L.B_TXNDATE = :p_DATE
                   AND TO_NUMBER(L.CLASSIFICATION) = 2
                UNION ALL
                SELECT TO_CHAR(C.SOL_ID) AS SOLID, C.BALANCE_MNT
                  FROM RISKASSESSMENT.CDC2010 C
                 WHERE C.SOL_ID = :p_SOLIDINPUT
                   AND C.B_TXNDATE = :p_DATE
                   AND REGEXP_LIKE(C.GRADE, '^[0-9]+$')
                   AND TO_NUMBER(C.GRADE) IN (2, 3)) SUB
               JOIN RISKASSESSMENT.BRANCHMAIN BM ON SUB.SOLID = BM.SOLID
               CROSS JOIN
               (SELECT NVL(SUM(x.BALANCEMNT), 0) AS total_bal
                  FROM (SELECT L2.BALANCEMNT
                          FROM RISKASSESSMENT.LNL2010 L2
                         WHERE L2.SOLID = :p_SOLIDINPUT AND L2.B_TXNDATE = :p_DATE
                        UNION ALL
                        SELECT C2.BALANCE_MNT
                          FROM RISKASSESSMENT.CDC2010 C2
                         WHERE C2.SOL_ID = :p_SOLIDINPUT
                           AND C2.B_TXNDATE = :p_DATE
                           AND (C2.GRADE IS NULL OR C2.GRADE != 'CR')) x) denom
         WHERE BM.TDATE = :p_DATE
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH, denom.total_bal
        UNION ALL
        -- 6: Чанаргүй зээл (balance percent)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               CASE WHEN denom.total_bal = 0 THEN '0'
                    ELSE TO_CHAR(ROUND(NVL(SUM(SUB.BALANCEMNT), 0) / denom.total_bal * 100, 2))
               END AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               CASE WHEN denom.total_bal = 0 THEN '0%'
                    ELSE TO_CHAR(ROUND(NVL(SUM(SUB.BALANCEMNT), 0) / denom.total_bal * 100, 2)) || '%'
               END AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Чанаргүй зээл' AS ID, '6' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM (SELECT TO_CHAR(L.SOLID) AS SOLID, L.BALANCEMNT
                  FROM RISKASSESSMENT.LNL2010 L
                 WHERE L.SOLID = :p_SOLIDINPUT
                   AND L.B_TXNDATE = :p_DATE
                   AND TO_NUMBER(L.CLASSIFICATION) > 2
                UNION ALL
                SELECT C.SOL_ID, C.BALANCE_MNT
                  FROM RISKASSESSMENT.CDC2010 C
                 WHERE C.SOL_ID = :p_SOLIDINPUT
                   AND C.B_TXNDATE = :p_DATE
                   AND REGEXP_LIKE(C.GRADE, '^[0-9]+$')
                   AND CASE WHEN REGEXP_LIKE(C.GRADE, '^[0-9]+$')
                            THEN TO_NUMBER(C.GRADE) ELSE NULL END > 3) SUB
               JOIN RISKASSESSMENT.BRANCHMAIN BM ON SUB.SOLID = BM.SOLID
               CROSS JOIN
               (SELECT NVL(SUM(x.BALANCEMNT), 0) AS total_bal
                  FROM (SELECT L2.BALANCEMNT
                          FROM RISKASSESSMENT.LNL2010 L2
                         WHERE L2.SOLID = :p_SOLIDINPUT AND L2.B_TXNDATE = :p_DATE
                        UNION ALL
                        SELECT C2.BALANCE_MNT
                          FROM RISKASSESSMENT.CDC2010 C2
                         WHERE C2.SOL_ID = :p_SOLIDINPUT
                           AND C2.B_TXNDATE = :p_DATE
                           AND (C2.GRADE IS NULL OR C2.GRADE != 'CR')) x) denom
         WHERE BM.TDATE = :p_DATE
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH, denom.total_bal
        UNION ALL
        -- 7: Чанаргүй зээлийн тоо (count percent)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               CASE WHEN denom.total_count = 0 THEN '0'
                    ELSE TO_CHAR(ROUND(COUNT(*) / denom.total_count * 100, 2))
               END AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               CASE WHEN denom.total_count = 0 THEN '0%'
                    ELSE TO_CHAR(ROUND(COUNT(*) / denom.total_count * 100, 2)) || '%'
               END AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Чанаргүй зээлийн тоо' AS ID, '7' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM (SELECT 1
                  FROM RISKASSESSMENT.LNL2010 L
                 WHERE L.SOLID = :p_SOLIDINPUT
                   AND L.B_TXNDATE = :p_DATE
                   AND TO_NUMBER(L.CLASSIFICATION) > 2
                UNION ALL
                SELECT 1
                  FROM RISKASSESSMENT.CDC2010 C
                 WHERE C.SOL_ID = :p_SOLIDINPUT
                   AND C.B_TXNDATE = :p_DATE
                   AND REGEXP_LIKE(C.GRADE, '^[0-9]+$')
                   AND CASE WHEN REGEXP_LIKE(C.GRADE, '^[0-9]+$')
                            THEN TO_NUMBER(C.GRADE) ELSE NULL END > 3) sub_rows
               JOIN RISKASSESSMENT.BRANCHMAIN BM ON BM.SOLID = :p_SOLIDINPUT
               CROSS JOIN
               (SELECT NVL(COUNT(*), 0) AS total_count
                  FROM (SELECT 1
                          FROM RISKASSESSMENT.LNL2010 L2
                         WHERE L2.SOLID = :p_SOLIDINPUT AND L2.B_TXNDATE = :p_DATE
                        UNION ALL
                        SELECT 1
                          FROM RISKASSESSMENT.CDC2010 C2
                         WHERE C2.SOL_ID = :p_SOLIDINPUT AND C2.B_TXNDATE = :p_DATE)) denom
         WHERE BM.TDATE = :p_DATE
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH, denom.total_count
        UNION ALL
        -- 8: KPI үнэлгээ
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND(KP.KPI * 100, 2)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(ROUND(KP.KPI * 100, 2)) || '%' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'БҮХ-н үнэлгээ' AS ID, '8' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM JOIN RISKASSESSMENT.KPIPERFORMANCE KP ON BM.SOLID = KP.SOLID
         WHERE BM.SOLID = :p_SOLIDINPUT AND BM.TDATE = :p_DATE AND KP.TDATE = :p_DATE
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH, KP.KPI
        UNION ALL
        -- 9: Борлуулалтын төлөвлөгөө
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND(SP.SALEPERFORMANCE / 15 * 100, 2)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(ROUND(SP.SALEPERFORMANCE / 15 * 100, 2)) || '%' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Тоон төлөвлөгөө' AS ID, '9' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM JOIN RISKASSESSMENT.SALESPERFORMANCE SP ON BM.SOLID = SP.SOLID
         WHERE BM.SOLID = :p_SOLIDINPUT AND BM.TDATE = :p_DATE AND SP.TDATE = :p_DATE
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH, SP.SALEPERFORMANCE
        UNION ALL
        -- 10: ХДХХ-д ирсэн гомдол
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(NVL(SUM(TO_NUMBER(RISKASSESSMENT.COMPLAINTS.COMPLAINTSFINISHED)), 0)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(NVL(SUM(TO_NUMBER(RISKASSESSMENT.COMPLAINTS.COMPLAINTSFINISHED)), 0)) AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'ХДХХ-д ирсэн гомдол' AS ID, '10' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN RISKASSESSMENT.BRANCHSUB BS ON BM.SOLID = BS.MAINSOLID
               JOIN RISKASSESSMENT.COMPLAINTS ON BS.SOLID = RISKASSESSMENT.COMPLAINTS.SOLID
         WHERE BM.SOLID = :p_SOLIDINPUT AND BM.TDATE = :p_DATE AND BS.TDATE = :p_DATE
           AND RISKASSESSMENT.COMPLAINTS.TDATE >=
               (SELECT NVL(MAX(t2.RANGEENDDATE), TO_DATE('1900-01-01', 'YYYY-MM-DD'))
                  FROM RISKASSESSMENT.BRANCHMAIN t1
                       JOIN RISKASSESSMENT.AUDITRESULT t2
                           ON t1.BRANCHID = t2.BRANCHID
                          AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                 WHERE t1.SOLID = :p_SOLIDINPUT
                   AND t2.TDATE = :p_DATE
                   AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                   AND t2.AUDITENDDATE <= :p_DATE)
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 11: Салбарын зэрэглэл
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               NVL(TO_CHAR(BG.GRADE), '') AS RESULT,
               'STRING' AS RESULT_TYPE,
               NVL(TO_CHAR(BG.GRADE), '') AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Салбарын зэрэглэл' AS ID, '11' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM JOIN RISKASSESSMENT.BRANCHGRADE BG ON BM.SOLID = BG.SOLID
         WHERE BM.SOLID = :p_SOLIDINPUT AND BM.TDATE = :p_DATE AND BG."DATE" = :p_DATE
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH, BG.GRADE
        UNION ALL
        -- 12: Ажилтнуудын ажилласан жилийн дундаж
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND(AVG((:p_DATE - TE.TAKEJOBDATE) / 365), 2)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(ROUND(AVG((:p_DATE - TE.TAKEJOBDATE) / 365), 2)) || ' жил' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Ажилтнуудын ажилласан жилийн дундаж' AS ID, '12' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN RISKASSESSMENT.BRANCHSUB BS ON BM.SOLID = BS.MAINSOLID
               JOIN RISKASSESSMENT.TOTALEMPLOYEE TE ON BS.SOLID = TE.SOLID
         WHERE TE.TDATE = :p_DATE AND TE.RDATE = :p_DATE
           AND BS.TDATE = :p_DATE AND BM.TDATE = :p_DATE
           AND BM.SOLID = :p_SOLIDINPUT
           AND UPPER(TE.EID) NOT IN (SELECT UPPER(x.EID)
                                       FROM (SELECT EID FROM RISKASSESSMENT.BRANCHDIRECTOR WHERE TDATE = :p_DATE
                                             UNION ALL
                                             SELECT EID FROM RISKASSESSMENT.BRANCHSENIOR WHERE TDATE = :p_DATE) x)
           AND UPPER(TE.POSITION) NOT LIKE '%АХЛАХ%'
           AND UPPER(TE.TYPE) LIKE '%ҮНДСЭН%'
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 13: Удирдах ажилтнуудын ажилласан жил
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND(AVG((:p_DATE - SUB.NOMINATEDDATE) / 365), 2)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(ROUND(AVG((:p_DATE - SUB.NOMINATEDDATE) / 365), 2)) || ' жил' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Удирдах ажилтнуудын ажилласан жил' AS ID, '13' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN RISKASSESSMENT.BRANCHSUB BS ON BM.SOLID = BS.MAINSOLID
               JOIN (SELECT * FROM RISKASSESSMENT.BRANCHDIRECTOR WHERE TDATE = :p_DATE
                     UNION ALL
                     SELECT * FROM RISKASSESSMENT.BRANCHSENIOR WHERE TDATE = :p_DATE) SUB
                   ON SUB.SOLID = BS.SOLID
         WHERE BM.SOLID = :p_SOLIDINPUT AND BM.TDATE = :p_DATE AND BS.TDATE = :p_DATE
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 14: Хүний нөөцийн эргэлт
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               CASE WHEN denom.total_staff = 0 THEN '0'
                    ELSE TO_CHAR(ROUND(COUNT(DISTINCT W.EID) / denom.total_staff * 100, 2))
               END AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               CASE WHEN denom.total_staff = 0 THEN '0%'
                    ELSE TO_CHAR(ROUND(COUNT(DISTINCT W.EID) / denom.total_staff * 100, 2)) || '%'
               END AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Хүний нөөцийн эргэц' AS ID, '14' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN RISKASSESSMENT.BRANCHSUB BS ON BM.SOLID = BS.MAINSOLID
               JOIN RISKASSESSMENT.WARNING W ON BS.SOLID = W.SOLID
               CROSS JOIN (SELECT (NVL((SELECT COUNT(TE.EID)
                                          FROM RISKASSESSMENT.BRANCHSUB B2
                                               JOIN RISKASSESSMENT.BRANCHMAIN BM2 ON B2.MAINSOLID = BM2.SOLID
                                               JOIN RISKASSESSMENT.TOTALEMPLOYEE TE ON B2.SOLID = TE.SOLID
                                         WHERE BM2.SOLID = :p_SOLIDINPUT
                                           AND TE.TDATE = :p_DATE
                                           AND B2.TDATE = :p_DATE
                                           AND TE.RDATE = :p_DATE
                                           AND UPPER(TE.TYPE) NOT LIKE 'ГЭРЭЭТ'), 0)
                                  + NVL((SELECT COUNT(TE2.EID)
                                           FROM RISKASSESSMENT.BRANCHSUB B3
                                                JOIN RISKASSESSMENT.BRANCHMAIN BM3 ON B3.MAINSOLID = BM3.SOLID
                                                JOIN RISKASSESSMENT.TOTALEMPLOYEE TE2 ON B3.SOLID = TE2.SOLID
                                          WHERE BM3.SOLID = :p_SOLIDINPUT
                                            AND TE2.TDATE = :p_DATE
                                            AND B3.TDATE = :p_DATE
                                            AND TE2.RDATE = ADD_MONTHS(:p_DATE, -12)
                                            AND UPPER(TE2.TYPE) NOT LIKE 'ГЭРЭЭТ'), 0)) / 2 AS total_staff
                             FROM DUAL) denom
         WHERE BM.SOLID = :p_SOLIDINPUT AND BM.TDATE = :p_DATE AND BS.TDATE = :p_DATE
           AND W.QUITJOBDATE BETWEEN ADD_MONTHS(:p_DATE, -12) AND :p_DATE
           AND UPPER(W.TYPE) NOT LIKE 'ГЭРЭЭТ'
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH, denom.total_staff
        UNION ALL
        -- 15: Орон тоо бүрэн эсэх
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               CASE WHEN NVL(den.total_positions, 0) = 0 THEN '0'
                    ELSE TO_CHAR(ROUND(COUNT(TE.EID) / den.total_positions * 100, 2))
               END AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               CASE WHEN NVL(den.total_positions, 0) = 0 THEN '0%'
                    ELSE TO_CHAR(ROUND(COUNT(TE.EID) / den.total_positions * 100, 2)) || '%'
               END AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Орон тоо бүрэн эсэх' AS ID, '15' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHSUB BS
               JOIN RISKASSESSMENT.BRANCHMAIN BM ON BS.MAINSOLID = BM.SOLID
               JOIN RISKASSESSMENT.TOTALEMPLOYEE TE ON BS.SOLID = TE.SOLID
               CROSS JOIN
               (SELECT NVL(SUM(AP.JOBPOSITIONNUMBER), 0) AS total_positions
                  FROM RISKASSESSMENT.BRANCHMAIN BM2
                       JOIN RISKASSESSMENT.BRANCHSUB BS2 ON BM2.SOLID = BS2.MAINSOLID
                       JOIN RISKASSESSMENT.APPOINTMENT AP ON BS2.SOLID = AP.SOLID
                 WHERE BM2.SOLID = :p_SOLIDINPUT AND AP.TDATE = :p_DATE
                   AND BS2.TDATE = :p_DATE AND BM2.TDATE = :p_DATE) den
         WHERE BM.SOLID = :p_SOLIDINPUT AND BS.TDATE = :p_DATE
           AND TE.TDATE = :p_DATE AND TE.RDATE = :p_DATE
           AND UPPER(TE.TYPE) NOT LIKE 'ГЭРЭЭТ'
           AND BM.TDATE = :p_DATE
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH, den.total_positions
        UNION ALL
        -- 16: Нэг ажилтанд ногдох сургалтын цаг
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               CASE WHEN denom.total_staff = 0 THEN '0'
                    ELSE TO_CHAR(ROUND(SUM(LT.TIME) / denom.total_staff, 2))
               END AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(ROUND(SUM(LT.TIME), 2)) || ' цаг, '
               || TO_CHAR(denom.total_staff) || ' ажилтан, '
               || CASE WHEN denom.total_staff = 0 THEN '0'
                       ELSE TO_CHAR(ROUND(SUM(LT.TIME) / denom.total_staff, 2))
                  END
               || ' цаг' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Нэг ажилтанд ногдох сургалтын цаг' AS ID, '16' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.TOTALEMPLOYEE TE
               JOIN RISKASSESSMENT.LEARNTIME LT ON TE.EID = LT.DOMAIN
               JOIN RISKASSESSMENT.BRANCHSUB BS ON TE.SOLID = BS.SOLID
               JOIN RISKASSESSMENT.BRANCHMAIN BM ON BS.MAINSOLID = BM.SOLID
               CROSS JOIN
               (SELECT NVL(COUNT(TE2.EID), 0) AS total_staff
                  FROM RISKASSESSMENT.BRANCHSUB B2
                       JOIN RISKASSESSMENT.BRANCHMAIN BM2 ON B2.MAINSOLID = BM2.SOLID
                       JOIN RISKASSESSMENT.TOTALEMPLOYEE TE2 ON B2.SOLID = TE2.SOLID
                 WHERE BM2.SOLID = :p_SOLIDINPUT AND BM2.TDATE = :p_DATE
                   AND B2.TDATE = :p_DATE
                   AND TE2.TDATE = :p_DATE AND TE2.RDATE = :p_DATE
                   AND UPPER(TE2.TYPE) NOT LIKE 'ГЭРЭЭТ') denom
         WHERE BM.SOLID = :p_SOLIDINPUT
           AND LT.BEGINDATE BETWEEN ADD_MONTHS(:p_DATE, -12) AND :p_DATE
           AND TE.RDATE = :p_DATE AND TE.TDATE = :p_DATE
           AND BM.TDATE = :p_DATE AND BS.TDATE = :p_DATE
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH, denom.total_staff
        UNION ALL
        -- 17: Зээлийн өр цуглуулах үйл ажиллагаа (RISKASSESSMENT.DEBITCOLLECTION)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND(AVG(DC.RESULT) * 100, 2)),
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(ROUND(AVG(DC.RESULT) * 100, 2)) || '%' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Зээлийн өр цуглуулах үйл ажиллагаа' AS ID, '17' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN RISKASSESSMENT.BRANCHSUB BS ON BM.SOLID = BS.MAINSOLID
               JOIN RISKASSESSMENT.DEBITCOLLECTION DC ON BS.SOLID = DC.SOLID
         WHERE BM.SOLID = :p_SOLIDINPUT AND BM.TDATE = :p_DATE AND BS.TDATE = :p_DATE
           AND DC.TDATE >=
               (SELECT NVL(MAX(t2.RANGEENDDATE), TO_DATE('1900-01-01', 'YYYY-MM-DD'))
                  FROM RISKASSESSMENT.BRANCHMAIN t1
                       JOIN RISKASSESSMENT.AUDITRESULT t2
                           ON t1.BRANCHID = t2.BRANCHID
                          AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                 WHERE t1.SOLID = :p_SOLIDINPUT
                   AND t2.TDATE = :p_DATE
                   AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                   AND t2.AUDITENDDATE <= :p_DATE)
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 18: Зээлийн эргэн хяналт (RISKASSESSMENT.LOANREMONITORING)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND(AVG(LR.RESULT) * 100, 2)),
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(ROUND(AVG(LR.RESULT) * 100, 2)) || '%' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Зээлийн эргэн хяналт' AS ID, '18' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN RISKASSESSMENT.BRANCHSUB BS ON BM.SOLID = BS.MAINSOLID
               JOIN RISKASSESSMENT.LOANREMONITORING LR ON BS.SOLID = LR.SOLID
         WHERE BM.SOLID = :p_SOLIDINPUT AND BS.TDATE = :p_DATE AND BM.TDATE = :p_DATE
           AND LR.TDATE >=
               (SELECT NVL(MAX(t2.RANGEENDDATE), TO_DATE('1900-01-01', 'YYYY-MM-DD'))
                  FROM RISKASSESSMENT.BRANCHMAIN t1
                       JOIN RISKASSESSMENT.AUDITRESULT t2
                           ON t1.BRANCHID = t2.BRANCHID
                          AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                 WHERE t1.SOLID = :p_SOLIDINPUT
                   AND t2.TDATE = :p_DATE
                   AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                   AND t2.AUDITENDDATE <= :p_DATE)
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 19: Зээлийн хэрэг бүртгэл (RISKASSESSMENT.ZHB)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND(AVG(RISKASSESSMENT.ZHB.RESULT) * 100, 2)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(ROUND(AVG(RISKASSESSMENT.ZHB.RESULT) * 100, 2)) || '%' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Зээлийн хэрэг бүртгэлийн үйл ажиллагаа' AS ID, '19' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN RISKASSESSMENT.BRANCHSUB BS ON BM.SOLID = BS.MAINSOLID
               JOIN RISKASSESSMENT.ZHB ON BS.SOLID = RISKASSESSMENT.ZHB.SOLID
         WHERE BM.SOLID = :p_SOLIDINPUT AND BM.TDATE = :p_DATE AND BS.TDATE = :p_DATE
           AND RISKASSESSMENT.ZHB.TDATE >=
               (SELECT NVL(MAX(t2.RANGEENDDATE), TO_DATE('1900-01-01', 'YYYY-MM-DD'))
                  FROM RISKASSESSMENT.BRANCHMAIN t1
                       JOIN RISKASSESSMENT.AUDITRESULT t2
                           ON t1.BRANCHID = t2.BRANCHID
                          AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                 WHERE t1.SOLID = :p_SOLIDINPUT
                   AND t2.TDATE = :p_DATE
                   AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                   AND t2.AUDITENDDATE <= :p_DATE)
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 20: Зээлийн материал буцаалт (RISKASSESSMENT.DOCUMENTATIONOFLOAN)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND(AVG(DL.RESULT) * 100, 2)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(ROUND(AVG(DL.RESULT) * 100, 2)) || '%' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Зээлийн материал буцаалт' AS ID, '20' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN RISKASSESSMENT.BRANCHSUB BS ON BM.SOLID = BS.MAINSOLID
               JOIN RISKASSESSMENT.DOCUMENTATIONOFLOAN DL ON BS.SOLID = DL.SOLID
         WHERE BM.SOLID = :p_SOLIDINPUT AND BM.TDATE = :p_DATE AND BS.TDATE = :p_DATE
           AND DL.TDATE >=
               (SELECT NVL(MAX(t2.RANGEENDDATE), TO_DATE('1900-01-01', 'YYYY-MM-DD'))
                  FROM RISKASSESSMENT.BRANCHMAIN t1
                       JOIN RISKASSESSMENT.AUDITRESULT t2
                           ON t1.BRANCHID = t2.BRANCHID
                          AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                 WHERE t1.SOLID = :p_SOLIDINPUT
                   AND t2.TDATE = :p_DATE
                   AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                   AND t2.AUDITENDDATE <= :p_DATE)
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 21: Даатгалын үйл ажиллагаа (RISKASSESSMENT.INSURANCE)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND(AVG(I.INSURANCE) * 100, 2)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(ROUND(AVG(I.INSURANCE) * 100, 2)) || '%' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Даатгалын үйл ажиллагаа' AS ID, '21' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN RISKASSESSMENT.BRANCHSUB BS ON BM.SOLID = BS.MAINSOLID
               JOIN RISKASSESSMENT.INSURANCE I ON BS.SOLID = I.SOLID
         WHERE BM.SOLID = :p_SOLIDINPUT AND BM.TDATE = :p_DATE AND BS.TDATE = :p_DATE
           AND I."DATE" BETWEEN
               (SELECT NVL(MAX(t2.RANGEENDDATE), TO_DATE('1900-01-01', 'YYYY-MM-DD'))
                  FROM RISKASSESSMENT.BRANCHMAIN t1
                       JOIN RISKASSESSMENT.AUDITRESULT t2
                           ON t1.BRANCHID = t2.BRANCHID
                          AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                 WHERE t1.SOLID = :p_SOLIDINPUT
                   AND t2.TDATE = :p_DATE
                   AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                   AND t2.AUDITENDDATE <= :p_DATE) AND :p_DATE
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 22: Хамрах хугацаанд олгосон чанаргүй зээл
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND(
                 (NVL(SUM(SUB.BALANCEMNT), 0)
                  / NULLIF((SELECT NVL(SUM(x.BALANCEMNT), 0)
                              FROM (SELECT L2.BALANCEMNT
                                      FROM RISKASSESSMENT.LNL2010 L2
                                     WHERE L2.SOLID = :p_SOLIDINPUT AND L2.B_TXNDATE = :p_DATE
                                    UNION ALL
                                    SELECT C2.BALANCE_MNT
                                      FROM RISKASSESSMENT.CDC2010 C2
                                     WHERE C2.SOL_ID = :p_SOLIDINPUT
                                       AND C2.B_TXNDATE = :p_DATE
                                       AND (C2.GRADE IS NULL OR C2.GRADE != 'CR')) x), 0))
                 * 100, 2)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               'Сүүлийн аудитаас хойш олгосон чанаргүй зээлийн тоо: '
               || TO_CHAR(NVL(COUNT(SUB.BALANCEMNT), 0))
               || '; Сүүлийн аудитаас хойш олгосон чанаргүй зээлийн хэмжээ: '
               || TO_CHAR(NVL(SUM(SUB.BALANCEMNT), 0))
               || '; Хамрах хугацаанд олгосон чанаргүй зээлийн нийт чанаргүй зээлд эзлэх хувь: '
               || TO_CHAR(ROUND(
                    (NVL(SUM(SUB.BALANCEMNT), 0)
                     / NULLIF((SELECT NVL(SUM(x.BALANCEMNT), 0)
                                 FROM (SELECT L2.BALANCEMNT
                                         FROM RISKASSESSMENT.LNL2010 L2
                                        WHERE L2.SOLID = :p_SOLIDINPUT AND L2.B_TXNDATE = :p_DATE
                                       UNION ALL
                                       SELECT C2.BALANCE_MNT
                                         FROM RISKASSESSMENT.CDC2010 C2
                                        WHERE C2.SOL_ID = :p_SOLIDINPUT
                                          AND C2.B_TXNDATE = :p_DATE
                                          AND (C2.GRADE IS NULL OR C2.GRADE != 'CR')) x), 0))
                    * 100, 2))
               || '%' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Хамрах хугацаанд олгосон чанаргүй зээл' AS ID, '22' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM (SELECT TO_CHAR(L.SOLID) AS SOLID, L.BALANCEMNT, L.OPENDATE
                  FROM RISKASSESSMENT.LNL2010 L
                 WHERE L.SOLID = :p_SOLIDINPUT
                   AND L.B_TXNDATE = :p_DATE
                   AND TO_NUMBER(L.CLASSIFICATION) > 2
                   AND L.OPENDATE >=
                       NVL((SELECT MAX(t2.RANGEENDDATE)
                              FROM RISKASSESSMENT.BRANCHMAIN t1
                                   JOIN RISKASSESSMENT.AUDITRESULT t2
                                       ON t1.BRANCHID = t2.BRANCHID
                                      AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                             WHERE t1.SOLID = :p_SOLIDINPUT
                               AND t2.TDATE = :p_DATE
                               AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                               AND t2.AUDITENDDATE <= :p_DATE),
                           TO_DATE('1900-01-01', 'YYYY-MM-DD'))
                UNION ALL
                SELECT TO_CHAR(C.SOL_ID) AS SOLID, C.BALANCE_MNT,
                       TO_DATE(C.ANNIV_DATE, 'YYYY-MM-DD') AS OPENDATE
                  FROM RISKASSESSMENT.CDC2010 C
                 WHERE C.SOL_ID = :p_SOLIDINPUT
                   AND C.B_TXNDATE = :p_DATE
                   AND REGEXP_LIKE(C.GRADE, '^[0-9]+$')
                   AND CASE WHEN REGEXP_LIKE(C.GRADE, '^[0-9]+$')
                            THEN TO_NUMBER(C.GRADE) ELSE NULL END > 3
                   AND TO_DATE(C.ANNIV_DATE, 'YYYY-MM-DD') >=
                       NVL((SELECT MAX(t2.RANGEENDDATE)
                              FROM RISKASSESSMENT.BRANCHMAIN t1
                                   JOIN RISKASSESSMENT.AUDITRESULT t2
                                       ON t1.BRANCHID = t2.BRANCHID
                                      AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                             WHERE t1.SOLID = :p_SOLIDINPUT
                               AND t2.TDATE = :p_DATE
                               AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                               AND t2.AUDITENDDATE <= :p_DATE),
                           TO_DATE('1900-01-01', 'YYYY-MM-DD'))) SUB
               JOIN RISKASSESSMENT.BRANCHMAIN BM ON SUB.SOLID = BM.SOLID
         WHERE BM.TDATE = :p_DATE
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 23: Хувийн хэргийн зөрчил
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND(AVG(SF.RATE) * 100, 2)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(ROUND(AVG(SF.RATE) * 100, 2)) || '%' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Хувийн хэргийн зөрчил' AS ID, '23' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN RISKASSESSMENT.BRANCHSUB BS ON BM.SOLID = BS.MAINSOLID
               JOIN RISKASSESSMENT.SCENEFAULTSOL SF ON BS.SOLID = SF.SOLID
         WHERE BM.TDATE = :p_DATE AND SF.TDATE = :p_DATE AND BS.TDATE = :p_DATE
           AND BM.SOLID = :p_SOLIDINPUT
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 24: Баримтын зөрчил (RISKASSESSMENT.DOCUMENTFAULTSOL)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND(AVG(DF.RESULT) * 100, 2)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(ROUND(AVG(DF.RESULT) * 100, 2)) || '%' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Баримтын зөрчил' AS ID, '24' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN RISKASSESSMENT.BRANCHSUB BS ON BM.SOLID = BS.MAINSOLID
               JOIN RISKASSESSMENT.DOCUMENTFAULTSOL DF ON BS.SOLID = DF.SOLID
         WHERE BM.TDATE = :p_DATE AND DF.TDATE = :p_DATE AND BS.TDATE = :p_DATE
           AND BM.SOLID = :p_SOLIDINPUT
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 25: Бүртгэлийн зайны хяналтын үнэлгээ (RISKASSESSMENT.REMOTECONTROL)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND(AVG(RC.BRANCHRESULT) * 100, 2)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(ROUND(AVG(RC.BRANCHRESULT) * 100, 2)) || '%' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Бүртгэлийн зайны хяналтын үнэлгээ' AS ID, '25' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM JOIN RISKASSESSMENT.REMOTECONTROL RC ON BM.SOLID = RC.SOLID
         WHERE BM.SOLID = :p_SOLIDINPUT AND BM.TDATE = :p_DATE
           AND RC.TDATE >=
               NVL((SELECT MAX(t2.RANGEENDDATE)
                      FROM RISKASSESSMENT.BRANCHMAIN t1
                           JOIN RISKASSESSMENT.AUDITRESULT t2
                               ON t1.BRANCHID = t2.BRANCHID
                              AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                     WHERE t1.SOLID = :p_SOLIDINPUT
                       AND t2.TDATE = :p_DATE
                       AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                       AND t2.AUDITENDDATE <= :p_DATE),
                   TO_DATE('1900-01-01', 'YYYY-MM-DD'))
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 26: Илүүдэл дутагдал (RISKASSESSMENT.ST7020)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(COUNT(ST.AMOUNT)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(COUNT(ST.AMOUNT)) AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Илүүдэл дутагдал гарсан эсэх' AS ID, '26' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM JOIN RISKASSESSMENT.ST7020 ST ON BM.SOLID = ST.ACCSOLID
         WHERE BM.SOLID = :p_SOLIDINPUT AND BM.TDATE = :p_DATE
           AND ((ST.AMOUNT >= 100000 AND ST.H_PART_TRAN_TYPE = 'D'
                 AND UPPER(ST.H_TRAN_PARTICULAR) LIKE '%ДУТАГДАЛ БҮРТГЭВ%'
                 AND UPPER(ST.H_TRAN_PARTICULAR) NOT LIKE '%REVERSE%')
             OR (ST.AMOUNT >= 100000 AND ST.H_PART_TRAN_TYPE = 'C'
                 AND UPPER(ST.H_TRAN_PARTICULAR) LIKE '%ИЛҮҮДЭЛ БҮРТГЭВ%'
                 AND UPPER(ST.H_TRAN_PARTICULAR) NOT LIKE '%REVERSE%'))
           AND ST.H_TRAN_DATE >=
               NVL((SELECT MAX(t2.RANGEENDDATE)
                      FROM RISKASSESSMENT.BRANCHMAIN t1
                           JOIN RISKASSESSMENT.AUDITRESULT t2
                               ON t1.BRANCHID = t2.BRANCHID
                              AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                     WHERE t1.SOLID = :p_SOLIDINPUT
                       AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                       AND t2.AUDITENDDATE <= :p_DATE),
                   TO_DATE('1900-01-01', 'YYYY-MM-DD'))
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 27: Орон нутгийн салбаруудын байр суурь (RISKASSESSMENT.BRANCHRANK)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND((BR.LOANPERCENT + BR.INCOMEPERCENT) / 2 * 100, 2)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(ROUND((BR.LOANPERCENT + BR.INCOMEPERCENT) / 2 * 100, 2)) || '%' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'ОН-н зах зээлд эзлэх байр суурь' AS ID, '27' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN RISKASSESSMENT.BRANCHRANK BR ON UPPER(BM.REGION) = UPPER(BR.REGION)
         WHERE BM.SOLID = :p_SOLIDINPUT AND BR.TDATE = :p_DATE AND BM.TDATE = :p_DATE
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
                  BR.LOANPERCENT, BR.INCOMEPERCENT
        UNION ALL
        -- 28: Монголбанкны шалгалтын үнэлгээ (RISKASSESSMENT.MBRESULT)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               NVL(TO_CHAR(MB.MBRESULT), '') AS RESULT,
               'STRING' AS RESULT_TYPE,
               NVL(TO_CHAR(MB.MBRESULT), '') AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Монголбанкны шалгалтын үнэлгээ' AS ID, '28' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM JOIN RISKASSESSMENT.MBRESULT MB ON BM.SOLID = MB.SOLID
         WHERE BM.SOLID = :p_SOLIDINPUT AND MB.TDATE = :p_DATE AND BM.TDATE = :p_DATE
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH, MB.MBRESULT
        UNION ALL
        -- 29: Мэдээллийн аюулгүй байдал (RISKASSESSMENT.MAB)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(COUNT(RISKASSESSMENT.MAB.TYPE)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(COUNT(RISKASSESSMENT.MAB.TYPE)) AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Харилцагчийн болон банкны нууцын зэрэглэлтэй мэдээллийн нууцлалыг хангаж ажилласан эсэх' AS ID,
               '29' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN RISKASSESSMENT.BRANCHSUB BS ON BM.SOLID = BS.MAINSOLID
               JOIN (SELECT SOLID, EID FROM RISKASSESSMENT.TOTALEMPLOYEE t1
                      WHERE t1.TDATE = :p_DATE AND t1.RDATE = :p_DATE
                     UNION ALL
                     SELECT SOLID, EID FROM RISKASSESSMENT.WARNING t2
                      WHERE t2.QUITJOBDATE <= :p_DATE
                        AND t2.QUITJOBDATE >= ADD_MONTHS(:p_DATE, -12)) SUBTAB
                   ON BS.SOLID = SUBTAB.SOLID
               JOIN RISKASSESSMENT.MAB ON SUBTAB.EID = RISKASSESSMENT.MAB.DOMAIN
         WHERE BM.TDATE = :p_DATE AND BS.TDATE = :p_DATE
           AND RISKASSESSMENT.MAB.TDATE BETWEEN :p_DATEBEG AND :p_DATE
           AND BM.SOLID = :p_SOLIDINPUT
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 30 (new): Өмнөх аудитын үнэлгээ (RISKASSESSMENT.HEADMAP + RISKASSESSMENT.AUDITRESULT)
        SELECT s.SOLID, s.BRANCHNAME, s.BRANCHID, s.PARENTBRANCH,
               CASE WHEN AVG(HM.RESULT) BETWEEN 2 AND 12 THEN 'ХАНГАЛТТАЙ'
                    WHEN AVG(HM.RESULT) BETWEEN 14 AND 36 THEN 'САЙЖРУУЛАХ ШААРДЛАГАТАЙ'
                    WHEN AVG(HM.RESULT) BETWEEN 38 AND 50 THEN 'ХАНГАЛТГҮЙ'
               END AS RESULT,
               'STRING' AS RESULT_TYPE,
               CASE WHEN AVG(HM.RESULT) BETWEEN 2 AND 12 THEN 'ХАНГАЛТТАЙ'
                    WHEN AVG(HM.RESULT) BETWEEN 14 AND 36 THEN 'САЙЖРУУЛАХ ШААРДЛАГАТАЙ'
                    WHEN AVG(HM.RESULT) BETWEEN 38 AND 50 THEN 'ХАНГАЛТГҮЙ'
               END AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Өмнөх аудитын үнэлгээ' AS ID, '30' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM (SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
                       AUD.AUDITBEGDATE,
                       ROUND(AVG(AUD.LIKELIHOOD), 0) AS LIKELIHOOD,
                       ROUND(AVG(AUD.IMPACT), 0) AS IMPACT,
                       ROUND(AVG(AUD.INTERNALRATE), 0) AS INTERNALRATE
                  FROM RISKASSESSMENT.BRANCHMAIN BM JOIN RISKASSESSMENT.AUDITRESULT AUD ON BM.BRANCHID = AUD.BRANCHID
                 WHERE BM.TDATE = :p_DATE
                   AND AUD.AUDITENDDATE =
                       (SELECT MAX(t2.AUDITENDDATE)
                          FROM RISKASSESSMENT.BRANCHMAIN t1
                               JOIN RISKASSESSMENT.AUDITRESULT t2
                                   ON t1.BRANCHID = t2.BRANCHID
                                  AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                         WHERE t1.SOLID = :p_SOLIDINPUT
                           AND t2.TDATE = :p_DATE
                           AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                           AND t2.AUDITBEGDATE >= TO_DATE('2019-11-19', 'YYYY-MM-DD')
                           AND t2.AUDITENDDATE <= :p_DATE)
                   AND BM.SOLID = :p_SOLIDINPUT
                   AND (SELECT MAX(t2.AUDITBEGDATE)
                          FROM RISKASSESSMENT.BRANCHMAIN t1
                               JOIN RISKASSESSMENT.AUDITRESULT t2
                                   ON t1.BRANCHID = t2.BRANCHID
                                  AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                         WHERE t1.SOLID = :p_SOLIDINPUT
                           AND t2.TDATE = :p_DATE
                           AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                           AND t2.AUDITBEGDATE <= :p_DATE) >= TO_DATE('2019-11-19', 'YYYY-MM-DD')
                 GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH, AUD.AUDITBEGDATE) s
               JOIN RISKASSESSMENT.HEADMAP HM
                   ON HM.IMPACT = s.IMPACT AND HM.LIKELIHOOD = s.LIKELIHOOD
         WHERE HM.TDATE = :p_DATE
         GROUP BY s.SOLID, s.BRANCHNAME, s.BRANCHID, s.PARENTBRANCH
        UNION ALL
        -- 30 (old): Өмнөх аудитын үнэлгээ
        SELECT s.SOLID, s.BRANCHNAME, s.BRANCHID, s.PARENTBRANCH,
               CASE WHEN AVG(HM.RESULT) <= 30 AND AVG(s.INTERNALRATE) <= 4 THEN 'Анхаарал татах том асуудал байхгүй'
                    WHEN AVG(HM.RESULT) <= 30 AND AVG(s.INTERNALRATE) > 4 THEN 'Тодорхой давтамжтай мониторинг шаардлагатай'
                    WHEN AVG(HM.RESULT) > 30 AND AVG(s.INTERNALRATE) <= 4 THEN 'Байнгын хяналт шаардлагатай'
                    WHEN AVG(HM.RESULT) > 30 AND AVG(s.INTERNALRATE) > 4 THEN 'Идэвхтэй менежмент хэрэгтэй'
               END AS RESULT,
               'STRING' AS RESULT_TYPE,
               CASE WHEN AVG(HM.RESULT) <= 30 AND AVG(s.INTERNALRATE) <= 4 THEN 'Анхаарал татах том асуудал байхгүй'
                    WHEN AVG(HM.RESULT) <= 30 AND AVG(s.INTERNALRATE) > 4 THEN 'Тодорхой давтамжтай мониторинг шаардлагатай'
                    WHEN AVG(HM.RESULT) > 30 AND AVG(s.INTERNALRATE) <= 4 THEN 'Байнгын хяналт шаардлагатай'
                    WHEN AVG(HM.RESULT) > 30 AND AVG(s.INTERNALRATE) > 4 THEN 'Идэвхтэй менежмент хэрэгтэй'
               END AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Өмнөх аудитын үнэлгээ' AS ID, '30' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM (SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
                       AUD.AUDITBEGDATE,
                       ROUND(AVG(AUD.LIKELIHOOD), 0) AS LIKELIHOOD,
                       ROUND(AVG(AUD.IMPACT), 0) AS IMPACT,
                       ROUND(AVG(AUD.INTERNALRATE), 0) AS INTERNALRATE
                  FROM RISKASSESSMENT.BRANCHMAIN BM
                       JOIN RISKASSESSMENT.AUDITRESULT AUD
                           ON BM.BRANCHID = AUD.BRANCHID
                          AND REGEXP_LIKE(BM.BRANCHID, '^[0-9]+$')
                 WHERE BM.TDATE = :p_DATE
                   AND AUD.AUDITBEGDATE =
                       (SELECT MAX(t2.AUDITBEGDATE)
                          FROM RISKASSESSMENT.BRANCHMAIN t1
                               JOIN RISKASSESSMENT.AUDITRESULT t2
                                   ON t1.BRANCHID = t2.BRANCHID
                                  AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                         WHERE t1.SOLID = :p_SOLIDINPUT
                           AND t2.TDATE = :p_DATE
                           AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                           AND t2.AUDITBEGDATE < TO_DATE('2019-11-19', 'YYYY-MM-DD')
                           AND t2.AUDITENDDATE <= :p_DATE)
                   AND BM.SOLID = :p_SOLIDINPUT
                   AND (SELECT MAX(t2.AUDITBEGDATE)
                          FROM RISKASSESSMENT.BRANCHMAIN t1
                               JOIN RISKASSESSMENT.AUDITRESULT t2
                                   ON t1.BRANCHID = t2.BRANCHID
                                  AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                         WHERE t1.SOLID = :p_SOLIDINPUT
                           AND t2.TDATE = :p_DATE
                           AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                           AND t2.AUDITBEGDATE <= :p_DATE) < TO_DATE('2019-11-19', 'YYYY-MM-DD')
                 GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH, AUD.AUDITBEGDATE) s
               JOIN RISKASSESSMENT.HEADMAP HM
                   ON HM.IMPACT = s.IMPACT AND HM.LIKELIHOOD = s.LIKELIHOOD
         WHERE HM.TDATE = :p_DATE
         GROUP BY s.SOLID, s.BRANCHNAME, s.BRANCHID, s.PARENTBRANCH
        UNION ALL
        -- 31 (new): Өндөр эрсдэлтэй асуудлын тоо
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND(
                 COUNT(HM.RESULT)
                 / NULLIF((SELECT COUNT(HM2.RESULT)
                             FROM RISKASSESSMENT.BRANCHMAIN BM2
                                  JOIN RISKASSESSMENT.AUDITRESULT AR2
                                      ON BM2.BRANCHID = AR2.BRANCHID
                                     AND REGEXP_LIKE(AR2.BRANCHID, '^[0-9]+$')
                                  JOIN RISKASSESSMENT.HEADMAP HM2
                                      ON AR2.LIKELIHOOD = HM2.LIKELIHOOD
                                     AND AR2.IMPACT = HM2.IMPACT
                            WHERE BM2.SOLID = :p_SOLIDINPUT
                              AND AR2.AUDITBEGDATE =
                                  (SELECT MAX(t2.AUDITBEGDATE)
                                     FROM RISKASSESSMENT.BRANCHMAIN t1
                                          JOIN RISKASSESSMENT.AUDITRESULT t2
                                              ON t1.BRANCHID = t2.BRANCHID
                                             AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                                    WHERE t1.SOLID = :p_SOLIDINPUT
                                      AND t2.TDATE = :p_DATE
                                      AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                                      AND t2.AUDITENDDATE <= :p_DATE)
                              AND HM2.TDATE = :p_DATE
                              AND AR2.TDATE = :p_DATE
                              AND BM2.TDATE = :p_DATE
                              AND (SELECT MAX(t2.AUDITBEGDATE)
                                     FROM RISKASSESSMENT.BRANCHMAIN t1
                                          JOIN RISKASSESSMENT.AUDITRESULT t2
                                              ON t1.BRANCHID = t2.BRANCHID
                                             AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                                    WHERE t1.SOLID = :p_SOLIDINPUT
                                      AND t2.TDATE = :p_DATE
                                      AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                                      AND t2.AUDITBEGDATE <= :p_DATE)
                                  >= TO_DATE('2019-11-19', 'YYYY-MM-DD')), 1)
                 * 100, 2)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               'Өндөр эрсдэлтэй асуудлын тоо:'
               || TO_CHAR(COUNT(HM.RESULT))
               || ' Нийт асуудлын тоо:'
               || TO_CHAR((SELECT COUNT(HM3.RESULT)
                             FROM RISKASSESSMENT.BRANCHMAIN BM3
                                  JOIN RISKASSESSMENT.AUDITRESULT AR3
                                      ON BM3.BRANCHID = AR3.BRANCHID
                                     AND REGEXP_LIKE(AR3.BRANCHID, '^[0-9]+$')
                                  JOIN RISKASSESSMENT.HEADMAP HM3
                                      ON AR3.LIKELIHOOD = HM3.LIKELIHOOD
                                     AND AR3.IMPACT = HM3.IMPACT
                            WHERE BM3.SOLID = :p_SOLIDINPUT
                              AND AR3.AUDITBEGDATE =
                                  (SELECT MAX(t2.AUDITBEGDATE)
                                     FROM RISKASSESSMENT.BRANCHMAIN t1
                                          JOIN RISKASSESSMENT.AUDITRESULT t2
                                              ON t1.BRANCHID = t2.BRANCHID
                                             AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                                    WHERE t1.SOLID = :p_SOLIDINPUT
                                      AND t2.TDATE = :p_DATE
                                      AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                                      AND t2.AUDITENDDATE <= :p_DATE)
                              AND HM3.TDATE = :p_DATE
                              AND AR3.TDATE = :p_DATE
                              AND BM3.TDATE = :p_DATE
                              AND (SELECT MAX(t2.AUDITBEGDATE)
                                     FROM RISKASSESSMENT.BRANCHMAIN t1
                                          JOIN RISKASSESSMENT.AUDITRESULT t2
                                              ON t1.BRANCHID = t2.BRANCHID
                                             AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                                    WHERE t1.SOLID = :p_SOLIDINPUT
                                      AND t2.TDATE = :p_DATE
                                      AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                                      AND t2.AUDITBEGDATE <= :p_DATE)
                                  >= TO_DATE('2019-11-19', 'YYYY-MM-DD'))) AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Өндөр эрсдэлтэй асуудлын тоо' AS ID, '31' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN RISKASSESSMENT.AUDITRESULT AR
                   ON BM.BRANCHID = AR.BRANCHID
                  AND REGEXP_LIKE(AR.BRANCHID, '^[0-9]+$')
               JOIN RISKASSESSMENT.HEADMAP HM
                   ON AR.LIKELIHOOD = HM.LIKELIHOOD AND AR.IMPACT = HM.IMPACT
         WHERE BM.SOLID = :p_SOLIDINPUT
           AND (HM.RESULT > 36 OR (HM.RESULT > 12 AND AR.INTERNALRATE > 2))
           AND AR.AUDITBEGDATE =
               (SELECT MAX(t2.AUDITBEGDATE)
                  FROM RISKASSESSMENT.BRANCHMAIN t1
                       JOIN RISKASSESSMENT.AUDITRESULT t2
                           ON t1.BRANCHID = t2.BRANCHID
                          AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                 WHERE t1.SOLID = :p_SOLIDINPUT
                   AND t2.TDATE = :p_DATE
                   AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                   AND t2.AUDITENDDATE <= :p_DATE)
           AND HM.TDATE = :p_DATE
           AND AR.TDATE = :p_DATE
           AND BM.TDATE = :p_DATE
           AND (SELECT MAX(t2.AUDITBEGDATE)
                  FROM RISKASSESSMENT.BRANCHMAIN t1
                       JOIN RISKASSESSMENT.AUDITRESULT t2
                           ON t1.BRANCHID = t2.BRANCHID
                          AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                 WHERE t1.SOLID = :p_SOLIDINPUT
                   AND t2.TDATE = :p_DATE
                   AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                   AND t2.AUDITBEGDATE <= :p_DATE) >= TO_DATE('2019-11-19', 'YYYY-MM-DD')
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 31 (old): Өндөр эрсдэлтэй асуудлын тоо
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND(
                 COUNT(HM.RESULT)
                 / NULLIF((SELECT COUNT(HM2.RESULT)
                             FROM RISKASSESSMENT.BRANCHMAIN BM2
                                  JOIN RISKASSESSMENT.AUDITRESULT AR2
                                      ON BM2.BRANCHID = AR2.BRANCHID
                                     AND REGEXP_LIKE(AR2.BRANCHID, '^[0-9]+$')
                                  JOIN RISKASSESSMENT.HEADMAP HM2
                                      ON AR2.LIKELIHOOD = HM2.LIKELIHOOD
                                     AND AR2.IMPACT = HM2.IMPACT
                            WHERE BM2.SOLID = :p_SOLIDINPUT
                              AND AR2.AUDITBEGDATE =
                                  (SELECT MAX(t2.AUDITBEGDATE)
                                     FROM RISKASSESSMENT.BRANCHMAIN t1
                                          JOIN RISKASSESSMENT.AUDITRESULT t2
                                              ON t1.BRANCHID = t2.BRANCHID
                                             AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                                    WHERE t1.SOLID = :p_SOLIDINPUT
                                      AND t2.TDATE = :p_DATE
                                      AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                                      AND t2.AUDITENDDATE <= :p_DATE)
                              AND HM2.TDATE = :p_DATE
                              AND AR2.TDATE = :p_DATE
                              AND BM2.TDATE = :p_DATE
                              AND (SELECT MAX(t2.AUDITBEGDATE)
                                     FROM RISKASSESSMENT.BRANCHMAIN t1
                                          JOIN RISKASSESSMENT.AUDITRESULT t2
                                              ON t1.BRANCHID = t2.BRANCHID
                                             AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                                    WHERE t1.SOLID = :p_SOLIDINPUT
                                      AND t2.TDATE = :p_DATE
                                      AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                                      AND t2.AUDITBEGDATE <= :p_DATE)
                                  < TO_DATE('2019-11-19', 'YYYY-MM-DD')), 1)
                 * 100, 2)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               'Өндөр эрсдэлтэй асуудлын тоо:'
               || TO_CHAR(COUNT(HM.RESULT))
               || ' Нийт асуудлын тоо:'
               || TO_CHAR((SELECT COUNT(HM3.RESULT)
                             FROM RISKASSESSMENT.BRANCHMAIN BM3
                                  JOIN RISKASSESSMENT.AUDITRESULT AR3
                                      ON BM3.BRANCHID = AR3.BRANCHID
                                     AND REGEXP_LIKE(AR3.BRANCHID, '^[0-9]+$')
                                  JOIN RISKASSESSMENT.HEADMAP HM3
                                      ON AR3.LIKELIHOOD = HM3.LIKELIHOOD
                                     AND AR3.IMPACT = HM3.IMPACT
                            WHERE BM3.SOLID = :p_SOLIDINPUT
                              AND AR3.AUDITBEGDATE =
                                  (SELECT MAX(t2.AUDITBEGDATE)
                                     FROM RISKASSESSMENT.BRANCHMAIN t1
                                          JOIN RISKASSESSMENT.AUDITRESULT t2
                                              ON t1.BRANCHID = t2.BRANCHID
                                             AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                                    WHERE t1.SOLID = :p_SOLIDINPUT
                                      AND t2.TDATE = :p_DATE
                                      AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                                      AND t2.AUDITENDDATE <= :p_DATE)
                              AND HM3.TDATE = :p_DATE
                              AND AR3.TDATE = :p_DATE
                              AND BM3.TDATE = :p_DATE
                              AND (SELECT MAX(t2.AUDITBEGDATE)
                                     FROM RISKASSESSMENT.BRANCHMAIN t1
                                          JOIN RISKASSESSMENT.AUDITRESULT t2
                                              ON t1.BRANCHID = t2.BRANCHID
                                             AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                                    WHERE t1.SOLID = :p_SOLIDINPUT
                                      AND t2.TDATE = :p_DATE
                                      AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                                      AND t2.AUDITBEGDATE <= :p_DATE)
                                  < TO_DATE('2019-11-19', 'YYYY-MM-DD'))) AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Өндөр эрсдэлтэй асуудлын тоо' AS ID, '31' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN RISKASSESSMENT.AUDITRESULT AR
                   ON BM.BRANCHID = AR.BRANCHID
                  AND REGEXP_LIKE(AR.BRANCHID, '^[0-9]+$')
               JOIN RISKASSESSMENT.HEADMAP HM
                   ON AR.LIKELIHOOD = HM.LIKELIHOOD AND AR.IMPACT = HM.IMPACT
         WHERE BM.SOLID = :p_SOLIDINPUT
           AND (HM.RESULT > 30 AND AR.INTERNALRATE > 4)
           AND AR.AUDITBEGDATE =
               (SELECT MAX(t2.AUDITBEGDATE)
                  FROM RISKASSESSMENT.BRANCHMAIN t1
                       JOIN RISKASSESSMENT.AUDITRESULT t2
                           ON t1.BRANCHID = t2.BRANCHID
                          AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                 WHERE t1.SOLID = :p_SOLIDINPUT
                   AND t2.TDATE = :p_DATE
                   AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                   AND t2.AUDITENDDATE <= :p_DATE)
           AND HM.TDATE = :p_DATE
           AND AR.TDATE = :p_DATE
           AND BM.TDATE = :p_DATE
           AND (SELECT MAX(t2.AUDITBEGDATE)
                  FROM RISKASSESSMENT.BRANCHMAIN t1
                       JOIN RISKASSESSMENT.AUDITRESULT t2
                           ON t1.BRANCHID = t2.BRANCHID
                          AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                 WHERE t1.SOLID = :p_SOLIDINPUT
                   AND t2.TDATE = :p_DATE
                   AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                   AND t2.AUDITBEGDATE <= :p_DATE) < TO_DATE('2019-11-19', 'YYYY-MM-DD')
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 32: Өмнөх аудитаас хойш хугацаа
        SELECT DISTINCT
               BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND((:p_DATE - AR.RANGEENDDATE) / 365, 2)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               (SELECT TO_CHAR(MAX(t2.RANGEENDDATE))
                  FROM RISKASSESSMENT.BRANCHMAIN t1
                       JOIN RISKASSESSMENT.AUDITRESULT t2
                           ON t1.BRANCHID = t2.BRANCHID
                          AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                 WHERE t1.SOLID = :p_SOLIDINPUT
                   AND t2.TDATE = :p_DATE
                   AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                   AND t2.AUDITENDDATE <= :p_DATE)
               || '; '
               || TO_CHAR(ROUND((:p_DATE - AR.RANGEENDDATE) / 365, 2))
               || ' жил' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Өмнөх аудитаас хойш хугацаа' AS ID, '32' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN RISKASSESSMENT.AUDITRESULT AR
                   ON BM.BRANCHID = AR.BRANCHID
                  AND REGEXP_LIKE(AR.BRANCHID, '^[0-9]+$')
         WHERE BM.SOLID = :p_SOLIDINPUT AND BM.TDATE = :p_DATE AND AR.TDATE = :p_DATE
           AND AR.AUDITBEGDATE =
               (SELECT MAX(t2.AUDITBEGDATE)
                  FROM RISKASSESSMENT.BRANCHMAIN t1
                       JOIN RISKASSESSMENT.AUDITRESULT t2
                           ON t1.BRANCHID = t2.BRANCHID
                          AND REGEXP_LIKE(t2.BRANCHID, '^[0-9]+$')
                 WHERE t1.SOLID = :p_SOLIDINPUT
                   AND t2.TDATE = :p_DATE
                   AND (t2.TYPE != 'followup' OR t2.TYPE IS NULL)
                   AND t2.AUDITENDDATE <= :p_DATE)
        UNION ALL
        -- 33: Follow up үнэлгээ (PL/SQL хувьсагчийг bind-ээр дамжуулсан)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND(:v_avgPercent, 2)) AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               ('Тооцсон зөвлөмжийн дундаж тоо: '
                || TO_CHAR(ROUND(:v_avgFollowupResultTotal, 2))
                || CASE WHEN :v_avgFollowupAddTotal IS NOT NULL
                        THEN '; Хойшилсон зөвлөмжийн дундаж тоо: '
                             || TO_CHAR(ROUND(:v_avgFollowupAddTotal, 2))
                        ELSE '' END
                || '; Дундаж үнэлгээ: '
                || TO_CHAR(ROUND(:v_avgPercent, 2))
                || '%; Хамгийн сүүлийн аудит: '
                || TO_CHAR(:v_lastAuditDate, 'YYYY-MM-DD')) AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Follow up үнэлгээ' AS ID, '33' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
         WHERE BM.SOLID = :p_SOLIDINPUT AND BM.TDATE = :p_DATE
        UNION ALL
        -- 34: Зайны аудитын үнэлгээ (RISKASSESSMENT.REMOTEAUDIT)
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               LTRIM(LISTAGG(';' || UPPER(x.TYPE) || ':' || TO_CHAR(x.CNT), '')
                     WITHIN GROUP (ORDER BY UPPER(x.TYPE)), ';') AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(SUM(x.CNT)) AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Зайны аудитын үнэлгээ' AS ID, '34' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN (SELECT RA.SOLID, UPPER(RA.TYPE) AS TYPE, COUNT(RA.RDATE) AS CNT
                       FROM RISKASSESSMENT.REMOTEAUDIT RA
                      WHERE RA.SOLID = :p_SOLIDINPUT
                        AND RA.RDATE BETWEEN :p_DATEBEG AND :p_DATE
                      GROUP BY RA.SOLID, UPPER(RA.TYPE)) x
                   ON BM.SOLID = x.SOLID
         WHERE BM.SOLID = :p_SOLIDINPUT AND BM.TDATE = :p_DATE
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
        UNION ALL
        -- 35: Ажилтны ур чадварын түвшин
        SELECT BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH,
               TO_CHAR(ROUND((SUM(k.EVOLUTION) / NULLIF(COUNT(DISTINCT k.DOMAIN), 0)) * 100, 2),
                       'FM9999990.00') AS RESULT,
               'NUMBER' AS RESULT_TYPE,
               TO_CHAR(ROUND((SUM(k.EVOLUTION) / NULLIF(COUNT(DISTINCT k.DOMAIN), 0)) * 100, 2),
                       'FM9999990.00') || '%' AS DESCRIPTION_TEXT,
               :p_DATEBEG, :p_DATE,
               'Ажилтны ур чадварын түвшин' AS ID, '35' AS SUBID, 'BRANCH' AS OPERATION_TYPE
          FROM RISKASSESSMENT.BRANCHMAIN BM
               JOIN riskassessment.HR_ASSessment k ON BM.SOLID = k.SOL
         WHERE BM.SOLID = :p_SOLIDINPUT AND BM.TDATE = :p_DATE AND k.TDATE = :p_DATE
         GROUP BY BM.SOLID, BM.BRANCHNAME, BM.BRANCHID, BM.PARENTBRANCH
`;
