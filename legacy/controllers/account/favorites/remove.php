<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>

<?
$iblockId = 3;

global $USER;
if (CModule::IncludeModule("iblock")) {
    if (!$_POST["id"]) {
        print_r(json_encode(Array("success" => false, "exceptionType" => "notIndex")));
        die();
    }

    /*if(CIBlock::GetPermission($IBLOCK_ID)>='W')
    {*/
        $DB->StartTransaction();
        if(!CIBlockElement::Delete($_POST["id"]))
        {
            $DB->Rollback();
        }
        else
            $DB->Commit();
    //}

    print_r(json_encode(Array("success" => true, "removeId" => $_POST["id"])));
}
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>