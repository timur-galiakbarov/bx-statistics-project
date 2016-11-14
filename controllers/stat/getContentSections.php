<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
if (CModule::IncludeModule("iblock")) {
    $arSelect = Array("ID", "NAME", "PREVIEW_TEXT", "PREVIEW_PICTURE", "ACTIVE_FROM", "PROPERTY_GROUP_SCREEN");
    $arFilter = Array("IBLOCK_ID" => 5, "ACTIVE" => "Y");
    $res = CIBlockElement::GetList(Array(), $arFilter, false, false, $arSelect);

    $list = '';
    $i=0;

    while ($ob = $res->GetNextElement()) {
        $arFields = $ob->GetFields();
        $list[$i]["id"] = $arFields["ID"];
        $list[$i]["name"] = $arFields["NAME"];
        $list[$i]["picture"] = CFile::GetPath($arFields["PREVIEW_PICTURE"]);
        $list[$i]["groups"] = $arFields["PROPERTY_GROUP_SCREEN_VALUE"];

        $i++;
    }

    print_r(json_encode(Array("data" => $list)));
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>