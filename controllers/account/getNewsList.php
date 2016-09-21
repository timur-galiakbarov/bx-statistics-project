<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
if (CModule::IncludeModule("iblock")) {
    $arSelect = Array("ID", "NAME", "PREVIEW_TEXT", "ACTIVE_FROM");
    $arFilter = Array("IBLOCK_ID" => 1, "ACTIVE" => "Y");
    $res = CIBlockElement::GetList(Array("ACTIVE_FROM" => "DESC"), $arFilter, false, false, $arSelect);

    $newsList = '';
    $i = 0;

    while ($ob = $res->GetNextElement()) {
        $arFields = $ob->GetFields();
        $newsList[$i]["id"] = $arFields["ID"];
        $newsList[$i]["name"] = $arFields["NAME"];
        $newsList[$i]["previewText"] = $arFields["PREVIEW_TEXT"];
        $newsList[$i]["date"] = $arFields["ACTIVE_FROM"];

        $i++;
    }
    print_r(json_encode(Array("data" => $newsList)));
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>