<?// подключение служебной части пролога
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>
<?

if(CModule::IncludeModule("iblock") && CIBlock::GetPermission($IBLOCK_ID)>='W')
{
    $DB->StartTransaction();
    if(!CIBlockElement::Delete($_POST["id"]))
    {
        $strWarning .= 'Error!';
        $DB->Rollback();
    }
    else
        $DB->Commit();

    print_r(json_encode(Array('success' => true, 'removeId' => $_POST["id"])));
}

?>
<?//----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/epilog_after.php");?>